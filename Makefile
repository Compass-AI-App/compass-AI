.PHONY: setup dev engine demo clean build-mac build-win build-linux build-all

setup: setup-engine setup-app

setup-engine:
	cd engine && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"

setup-app:
	cd app && npm install

dev:
	cd app && npm run dev

engine:
	cd engine && .venv/bin/python -m compass.server

demo:
	cd demo && bash run_demo.sh

build-mac: setup
	cd app && npm run build:mac

build-win: setup
	cd app && npm run build:win

build-linux: setup
	cd app && npm run build:linux

build-all: setup
	cd app && npm run build:all

clean:
	rm -rf engine/.venv engine/*.egg-info
	rm -rf app/node_modules app/dist app/dist-electron app/release
