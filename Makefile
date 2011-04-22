
CXX=$(TOOLCHAIN)g++
STRIP=$(TOOLCHAIN)strip

CPPFLAGS=$(DEVICEOPTS) -I$(PALMPDK)/include -I$(PALMPDK)/include/SDL -D_GNU_SOURCE=1 -D_REENTRANT -Isrc -Wall
LDFLAGS=$(DEVICEOPTS) -Wl,--allow-shlib-undefined -L$(PALMPDK)/$(TARGET)/lib

LIBS_PLUGIN=-lSDL -lGLESv2 -lpdl -lm -lSDL_image
LIBS_CLI=-lSDL_image -lm

TARGET = device

-include Makefile.custom

# defaults for customizable vars
ifeq ($(TARGET),host)
PALMPDK ?= /usr
DEVICEOPTS ?= -g
TOOLCHAIN ?=
BUILD ?= build-host

else ifeq ($(TARGET),emu)
PALMPDK ?= /opt/PalmPDK
DEVICEOPTS ?= -g -m32 -march=i686
TOOLCHAIN ?=
BUILD ?= build-emu

else
PALMPDK ?= /opt/PalmPDK
DEVICEOPTS ?= -g -mcpu=cortex-a8 -mfpu=neon -mfloat-abi=softfp
TOOLCHAIN ?= arm-none-linux-gnueabi-

BUILD ?= build
endif

# end of custom vars

DIRS := $(BUILD) $(patsubst %,$(BUILD)/zxing/%,common common/reedsolomon qrcode qrcode/detector qrcode/decoder oned datamatrix datamatrix/detector datamatrix/decoder)

SOURCES := $(shell find src/zxing -name '*.cpp') src/SDLImageSource.cpp
OBJS := $(patsubst src/%.cpp,$(BUILD)/%.o,$(SOURCES))
ALLOBJS := $(OBJS) $(BUILD)/qrdecode.o $(BUILD)/qrdecode-test.o

all: package

$(DIRS):
	mkdir -p $@

$(ALLOBJS): $(BUILD)/%.o: src/%.cpp | $(DIRS)
	$(CXX) -c $(CPPFLAGS) $(CXXFLAGS) $< -o $@

$(BUILD)/qrdecode-test: $(OBJS) $(BUILD)/qrdecode-test.o
	$(CXX) $(LDFLAGS) $(LIBS_CLI) $^ -o $@

$(BUILD)/qrdecode_plugin-dbg: $(OBJS) $(BUILD)/qrdecode.o
	$(CXX) $(LDFLAGS) $(LIBS_PLUGIN) $^ -o $@

$(BUILD)/qrdecode_plugin: $(BUILD)/qrdecode_plugin-dbg
	$(STRIP) --strip-unneeded -o $@ $<

package: $(BUILD)/qrdecode_plugin
	cp $(BUILD)/qrdecode_plugin de.stbuehler.qrdecoder/qrdecode_plugin
	palm-package de.stbuehler.qrdecoder

install:
	palm-install de.stbuehler.qrdecoder_*.ipk

launch:
	palm-launch de.stbuehler.qrdecoder

testcli: $(BUILD)/qrdecode-test

clean:
	rm -f $(OBJS)
	rm -f $(BUILD)/qrdecode_plugin $(BUILD)/qrdecode_plugin-dbg $(BUILD)/qrdecode-test
	rm -rf $(BUILD)

.PHONY: all package install launch clean testcli
