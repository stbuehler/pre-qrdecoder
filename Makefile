
CXX=$(TOOLCHAIN)g++
STRIP=$(TOOLCHAIN)strip

CPPFLAGS=$(MISCFLAGS) $(DEVICEOPTS) -I$(PALMPDK)/include -I$(PALMPDK)/include/SDL -D_GNU_SOURCE=1 -D_REENTRANT -Isrc -Wall
LDFLAGS=$(MISCFLAGS) $(DEVICEOPTS) -Wl,--allow-shlib-undefined -L$(PALMPDK)/$(TARGET)/lib

MISCFLAGS=-O2 -g

LIBS_PLUGIN=-lSDL -lpdl -lm -lSDL -lSDL_image
LIBS_CLI=-lSDL -lSDL_image -lm

TARGET = device

-include Makefile.custom

# defaults for customizable vars
ifeq ($(TARGET),host)
PALMPDK ?= /usr
DEVICEOPTS ?=
TOOLCHAIN ?=
BUILD ?= build-host

else ifeq ($(TARGET),emulator)
PALMPDK ?= /opt/PalmPDK
DEVICEOPTS ?= -m32 -march=i686
TOOLCHAIN ?=
BUILD ?= build-emulator
# gles not available
LIBS_PLUGIN=-lSDL -lpdl -lm -lSDL_image

else
PALMPDK ?= /opt/PalmPDK
# Pixi+Pre
DEVICEOPTS ?= -mcpu=arm1136jf-s -mfpu=vfp -mfloat-abi=softfp
# Pre only
# DEVICEOPTS ?= -mcpu=cortex-a8 -mfpu=neon -mfloat-abi=softfp

TOOLCHAIN ?= /opt/PalmPDK/arm-gcc/bin/arm-none-linux-gnueabi-
# arm-2009q1 toolchain (and older) need a workaround for fmaxl / fminl
#    see http://sourceware.org/bugzilla/show_bug.cgi?id=10103
CPPFLAGS += -Dfmaxl=fmax -Dfminl=fmin

BUILD ?= build
endif

ifeq ($(DEBUG),1)
PLUGIN_BINARY=qrdecode_plugin-dbg
else
PLUGIN_BINARY=qrdecode_plugin
endif

# end of custom vars

DIRS := $(BUILD) $(patsubst %,$(BUILD)/zxing/%,common common/detector common/reedsolomon qrcode qrcode/detector qrcode/decoder oned datamatrix datamatrix/detector datamatrix/decoder multi multi/qrcode multi/qrcode/detector)

SOURCES := $(shell find src/zxing -name '*.cpp') src/SDLImageSource.cpp
LIB_OBJS := $(patsubst src/%.cpp,$(BUILD)/%.o,$(SOURCES))
CPPOBJS := $(LIB_OBJS) $(BUILD)/qrdecode.o $(BUILD)/qrdecode-test.o $(BUILD)/qrencode-test.o

all: package

$(DIRS):
	mkdir -p $@

$(CPPOBJS): $(BUILD)/%.o: src/%.cpp | $(DIRS)
	$(CXX) -c $(CPPFLAGS) $(CXXFLAGS) $< -o $@

$(BUILD)/qrdecode-test: $(LIB_OBJS) $(BUILD)/qrdecode-test.o
	$(CXX) $^ $(LDFLAGS) $(LIBS_CLI) -o $@

$(BUILD)/qrdecode_plugin-dbg: $(LIB_OBJS) $(BUILD)/qrdecode.o
	$(CXX) $^ $(LDFLAGS) $(LIBS_PLUGIN) -o $@

$(BUILD)/qrdecode_plugin: $(BUILD)/qrdecode_plugin-dbg
	$(STRIP) --strip-unneeded -o $@ $<

package: $(BUILD)/$(PLUGIN_BINARY)
	cp $(BUILD)/$(PLUGIN_BINARY) de.stbuehler.qrdecoder/qrdecode_plugin
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
