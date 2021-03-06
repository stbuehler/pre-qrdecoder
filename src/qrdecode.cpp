
/*
 *  Copyright 2011 Stefan Bühler
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

extern "C" {
#include <SDL_thread.h>

#include <SDL.h>
#include <PDL.h>
#include <unistd.h>
}

#include <zxing/common/Counted.h>
#include <zxing/Result.h>

#include <queue>
#include <iostream>

#include "SDLImageSource.h"

const char DECODE_REQUEST_ID[] = "decode-0";

using namespace zxing;

PDL_Err CallJS(const char *functionName, const char **params, int numParams) {
	PDL_Err mjErr;
	int i;
	/* try max 10 times, 100 msec. make sure your plugin methods are faster than this */
	for (i = 0; i < 10; i++) {
		mjErr = PDL_CallJS(functionName, params, numParams);
		if (2 != mjErr) return mjErr;
		usleep(10000);
	}
	std::cerr << "PDL_CallJS error (" << mjErr << "): " << PDL_GetError() << "\n";
	std::cerr << "Stopping plugin\n";

	PDL_Quit();
	SDL_Quit();
	exit(1);
}
#define PDL_CallJS CallJS

std::string hexEncode(const std::string &s) {
	static const char hexChar[] = "0123456789abcdef";
	int l = s.length();
	std::string hex(l * 2, '\0');
	for (int i = 0; i < l; i++) {
		unsigned char c = s[i];
		hex[2*i] = hexChar[0xf & (c >> 4)];
		hex[2*i+1] = hexChar[0xf & c]; 
	}
	return hex;
}

void plugin_decode_exception(const char *msg) {
	const char *params[2];
	params[0] = DECODE_REQUEST_ID;
	params[1] = msg;
	PDL_Err mjErr = PDL_CallJS("asyncResult", params, 2);
	if ( mjErr != PDL_NOERROR ) {
		std::cerr << "PDL_CallJS error (" << mjErr << "): " << PDL_GetError() << "\n";
	}
}

void plugin_decode_success(const char *result, const char *barcodeFormat) {
	const char *params[4];
	params[0] = DECODE_REQUEST_ID;
	params[1] = "";
	params[2] = result;
	params[3] = barcodeFormat;
	PDL_Err mjErr = PDL_CallJS("asyncResult", params, 4);
	if ( mjErr != PDL_NOERROR ) {
		std::cerr << "PDL_CallJS error (" << mjErr << "): " << PDL_GetError() << "\n";
	}
}

void plugin_decode(std::string filename) {
	Ref<SDLBitmapSource> source(new SDLBitmapSource());
	if (!source->load(filename.c_str())) {
		plugin_decode_exception("Couldn't load image");
		return;
	}

	try {
		Ref<Result> result;
		result = qrDecode(source);

		std::cout << "Decode result: " << *result << "\n";
	
		std::string hexResult = hexEncode(result->getText()->getText());
		std::cout << "Decode result(hex): " << hexResult << "\n";
	
		plugin_decode_success(hexResult.c_str(), zxing::barcodeFormatNames[result->getBarcodeFormat()]);
	} catch (std::exception &e) {
		plugin_decode_exception(e.what());
		std::cerr << "Decoding failed: " << e.what() << "\n";
	} catch (...) {
		plugin_decode_exception("Unknown exception");
		std::cerr << "Decoding failed: Unknown exception\n";
	}
}

static void decode_cli(const char *filename) {
	Ref<SDLBitmapSource> source(new SDLBitmapSource());
	if (!source->load(filename)) {
		return;
	}

	try {
		Ref<Result> result(qrDecode(source));

		std::cout << "Decode result: " << *result << "\n";
	} catch (std::exception &e) {
		std::cerr << "Decoding failed: " << e.what() << "\n";
	} catch (...) {
		std::cerr << "Decoding failed: Unknown exception\n";
	}
}

typedef std::string DecodeJob;
SDL_mutex *job_queue_lock = 0;
std::queue<DecodeJob> job_queue; 


PDL_bool decode(PDL_JSParameters *params) {
	const char *filename;

	if (1 != PDL_GetNumJSParams(params) || 0 == (filename = PDL_GetJSParamString(params, 0))) {
		PDL_JSException(params, "You must give a filename");
		return PDL_FALSE;
	}

	SDL_mutexP(job_queue_lock);
	job_queue.push(DecodeJob(filename));
	SDL_mutexV(job_queue_lock);

	SDL_Event equeue;
	equeue.type = SDL_USEREVENT;
	equeue.user.code = 0;
	SDL_PushEvent(&equeue);

	PDL_JSReply(params, DECODE_REQUEST_ID);
	return PDL_TRUE;
}
PDL_bool checkPlugin(PDL_JSParameters *params) {
	return PDL_TRUE;
}

void jobqueue() {
	for ( ;; ) {
		SDL_mutexP(job_queue_lock);
		if (job_queue.empty()) {
			SDL_mutexV(job_queue_lock);
			return;
		}

		DecodeJob job = job_queue.front();
		job_queue.pop();
		SDL_mutexV(job_queue_lock);

		plugin_decode(job);
	}
}

static void init() {
	if (0 != SDL_Init(SDL_INIT_VIDEO)) {
		std::cerr << "Could not init SDL: " << SDL_GetError() << "\n";
		exit(1);
	}

	PDL_Init(0);

	init_sdlimage_source();

	if (PDL_IsPlugin()) {
		job_queue_lock = SDL_CreateMutex();

		PDL_RegisterJSHandler("decode", decode);
		PDL_RegisterJSHandler("check", checkPlugin);
		PDL_JSRegistrationComplete();
	}
}


int main(int argc, char** argv) {
	init();

	if (!PDL_IsPlugin()) {
		if (argc > 1) {
			decode_cli(argv[1]);
			exit(0);
		} else {
			std::cerr << "call as plugin or with filename as parameter\n";
			exit(1);
		}
	}

	bool signaledReady = false;

	/* loop */
	SDL_Event Event;
	do {
		if (!signaledReady) {
			PDL_Err mjErr = PDL_CallJS("ready", NULL, 0);
			if ( mjErr != PDL_NOERROR ) {
				std::cerr << "PDL_CallJS error: " << PDL_GetError() << "\n";
			} else {
				signaledReady = true;
			}
		}

		if (!signaledReady) {
			if (0 == SDL_PollEvent(NULL)) {
				/* no event ready, wait 1 second and try calling "ready" again */
				sleep(1);
				continue;
			}
		}

		SDL_WaitEvent(&Event);
		switch (Event.type) {
		case SDL_USEREVENT:
			jobqueue();
			break;
		}
	} while (Event.type != SDL_QUIT);

	SDL_DestroyMutex(job_queue_lock);
	job_queue_lock = 0;

	PDL_Quit();
	SDL_Quit();

	return 0;
}
