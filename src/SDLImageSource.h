
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
