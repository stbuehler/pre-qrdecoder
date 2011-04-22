
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
