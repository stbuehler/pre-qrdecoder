
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
/* memset */
#include <string.h>
}

#include <zxing/common/Counted.h>
#include <zxing/LuminanceSource.h>
#include <zxing/Binarizer.h>
#include <zxing/common/HybridBinarizer.h>
#include <zxing/common/GlobalHistogramBinarizer.h>
#include <zxing/BinaryBitmap.h>
#include <zxing/MultiFormatReader.h>
#include <zxing/qrcode/QRCodeReader.h>
#include <zxing/DecodeHints.h>
#include <zxing/Result.h>

#include <zxing/ReaderException.h>

#include <iostream>

#include "SDLImageSource.h"

/*
// Greyscale pixelformat to convert with sdl operations.. wasn't good enough though,
// so converting it manually now
static SDL_PixelFormat greyscale_pf;
static SDL_Color greyscale_colors[256];
static SDL_Palette greyscale_palette = { 256, greyscale_colors };
*/

SDLBitmapSource::SDLBitmapSource() : m_matrix(0) { }
SDLBitmapSource::~SDLBitmapSource() {
	delete[] m_matrix;
	m_matrix = 0;
}

bool SDLBitmapSource::load(const char *filename) {
	SDL_Surface *m_fileimage = IMG_Load(filename);
	if (0 == m_fileimage) {
		std::cerr << "IMG_Load: " << IMG_GetError() << "\n";
		return false;
	}
	
	m_width = m_fileimage->w;
	m_height = m_fileimage->h;
	
	m_matrix = new unsigned char[m_width * m_height];
	unsigned char *to = m_matrix;
	int step = m_fileimage->format->BytesPerPixel;
	for (int y = 0; y < m_height; y++) {
		unsigned char *pixels = static_cast<unsigned char*>(m_fileimage->pixels) + y * m_fileimage->pitch;
		for (int x = 0; x < m_width; x++, to++, pixels += step) {
			Uint8 r, g, b; r = g = b = 0;
			Uint32 val;
			switch (step) {
			case 4:
				SDL_GetRGB(*(Uint32*)pixels, m_fileimage->format, &r, &g, &b);
				break;
			case 3:
				val = 0;
				memcpy(&val, pixels, 3);
				SDL_GetRGB(val, m_fileimage->format, &r, &g, &b);
				break;
			case 2:
				SDL_GetRGB(*(Uint16*)pixels, m_fileimage->format, &r, &g, &b);
				break;
			case 1:
				SDL_GetRGB(*(Uint8*)pixels, m_fileimage->format, &r, &g, &b);
				break;
			default:
				std::cerr << "Unusable BytesPerPixel: " << step << "\n";
				SDL_FreeSurface(m_fileimage);
				return false;
			}
			*to = (unsigned char)((306 * ((Uint32)r) + 601 * ((Uint32)g) + 117 * ((Uint32)b) + 0x200) >> 10);
		}
	}

	SDL_FreeSurface(m_fileimage);

	return true;
}

int SDLBitmapSource::getWidth() const { return m_width; }
int SDLBitmapSource::getHeight() const { return m_height; }

unsigned char* SDLBitmapSource::getRow(int y, unsigned char* row) {
	if (0 == row) row = new unsigned char[m_width];
	memcpy(row, m_matrix + m_width * y, m_width);
	return row;
}

unsigned char* SDLBitmapSource::getMatrix() {
	unsigned char *matrix = new unsigned char[m_width * m_height];
	memcpy(matrix, m_matrix, m_width * m_height);
	return matrix;
}

using namespace zxing;

zxing::Ref<zxing::Result> qrDecode(zxing::Ref<zxing::LuminanceSource> source) {
	zxing::DecodeHints hints(zxing::DecodeHints::DEFAULT_HINT);
	hints.setTryHarder(true);

//	zxing::Ref<zxing::Reader> reader(new zxing::qrcode::QRCodeReader());
	zxing::Ref<zxing::Reader> reader(new zxing::MultiFormatReader());
	try {
		zxing::Ref<zxing::BinaryBitmap> bitmap(new zxing::BinaryBitmap(zxing::Ref<zxing::GlobalHistogramBinarizer>(new zxing::GlobalHistogramBinarizer(source))));
		return reader->decode(bitmap, hints);
	} catch (zxing::ReaderException &e) {
		zxing::Ref<zxing::BinaryBitmap> bitmap(new zxing::BinaryBitmap(zxing::Ref<zxing::HybridBinarizer>(new zxing::HybridBinarizer(source))));
		return reader->decode(bitmap, hints);
	}
}

void init_sdlimage_source() {
/*
//	IMG_Init(IMG_INIT_JPG);

	memset(&greyscale_pf, 0, sizeof(greyscale_pf));

//	greyscale_pf.format = SDL_PIXELFORMAT_INDEX8;
	greyscale_pf.palette = &greyscale_palette;
	greyscale_pf.BitsPerPixel = 8;
	greyscale_pf.BytesPerPixel = 1;
	greyscale_pf.colorkey = 255;

	SDL_Color *c = greyscale_colors;
	for (int i = 0; i < 256; i++, c++) {
		c->r = c->g = c->b = i;
	}
*/
}
