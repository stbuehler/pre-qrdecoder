
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

/* command line app - doesn't need PDK to link and run */

#include <zxing/common/Counted.h>
#include <zxing/Result.h>

#include <queue>
#include <iostream>

#include "SDLImageSource.h"

using namespace zxing;

static void decode_cli(const char *filename) {
	Ref<SDLBitmapSource> source(new SDLBitmapSource());
	if (!source->load(filename)) {
		return;
	}

	try {
		Ref<Result> result(qrDecode(source));

		std::cout << "Decode result: " << *result << "\n";
		std::cout << "Barcode Format: " << zxing::barcodeFormatNames[result->getBarcodeFormat()] << "\n";
	} catch (std::exception &e) {
		std::cerr << "Decoding failed: " << e.what() << "\n";
	} catch (...) {
		std::cerr << "Decoding failed: Unknown exception\n";
	}
}

int main(int argc, char** argv) {
	init_sdlimage_source();

	if (argc > 1) {
		decode_cli(argv[1]);
		exit(0);
	} else {
		std::cerr << "call as plugin or with filename as parameter\n";
		exit(1);
	}
	return 0;
}
