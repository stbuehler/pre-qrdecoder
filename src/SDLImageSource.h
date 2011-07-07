
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
#include <SDL_image.h>
}

#include <zxing/common/Counted.h>
#include <zxing/LuminanceSource.h>
#include <zxing/Result.h>


class SDLBitmapSource : public zxing::LuminanceSource {
private:
	int m_width, m_height;
	unsigned char *m_matrix;

	SDLBitmapSource(const SDLBitmapSource&);
	SDLBitmapSource& operator=(const SDLBitmapSource&);

public:
	SDLBitmapSource();
	virtual ~SDLBitmapSource();
	bool load(const char *filename);
	virtual int getWidth() const;
	virtual int getHeight() const;
	virtual unsigned char* getRow(int y, unsigned char* row);
	virtual unsigned char* getMatrix();
};

zxing::Ref<zxing::Result> qrDecode(zxing::Ref<zxing::LuminanceSource> source);
void init_sdlimage_source();
