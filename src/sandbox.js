const fs = require('fs');
const path = require('path');
const { promiseMethods, fsMethods } = require('./methods.js');

let _isBoxed = false;

const realMembers = {promises: {}};
for (const methodName of Object.keys(fsMethods)) {
	realMembers[methodName] = fs[methodName];
}
for (const methodName of Object.keys(promiseMethods)) {
	realMembers.promises[methodName] = fs.promises[methodName];
}

function sandbox(...dirs) {
	const fakeMembers = {promises: {}};
	for (const methodName of Object.keys(fsMethods)) {
		fakeMembers[methodName] = getProxy(realMembers, fsMethods, methodName, dirs);
	}
	for (const methodName of Object.keys(promiseMethods)) {
		fakeMembers.promises[methodName] = getProxy(realMembers.promises, promiseMethods, methodName, dirs);
	}
	assign(fakeMembers);
	_isBoxed = true;
}

function unbox() {
	assign(realMembers);
	_isBoxed = true;
}

function isBoxed() {
	return _isBoxed;
}

function assign(members) {
	for (const methodName of Object.keys(fsMethods)) {
		fs[methodName] = members[methodName];
	}
	for (const methodName of Object.keys(promiseMethods)) {
		fs.promises[methodName] = members.promises[methodName];
	}
}

function getProxy(realNamespace, methodPaths, methodName, sandboxDirs) {
	switch (methodName) {
		case 'access':
		case 'accessSync': return function (...args) {
			if (args[1] & fs.constants.W_OK) {
				verify(args[0], sandboxDirs);
			}
			return realNamespace[methodName](...args);
		};
		case 'open':
		case 'openSync': {
			return function (...args) {
				if (/[aw+]/i.test(args[1])) {
					verify(args[0], sandboxDirs);
				}
				return realNamespace[methodName](...args);
			};
		}
		default: {
			const indexes = methodPaths[methodName].map(pathIndex => {
				const index = Math.abs(pathIndex);
				const expectsLink = index !== pathIndex;
				return [index - 1, expectsLink];
			});
			return function (...args) {
				for (const [index, expectsLink] of indexes) {
					verify(args[index], sandboxDirs, expectsLink);
				}
				return realNamespace[methodName](...args);
			};
		}
	}
}

function verify(pathToVerify, sandboxDirs, expectsLink) {
	if (typeof pathToVerify === 'string') {
		if (expectsLink) {
			// If this path is expected to be a link,
			// only its parent and ancestors need to be real and inside the sandbox.
			pathToVerify = path.dirname(pathToVerify);
		}
		pathToVerify = realExistingPartOfPath(pathToVerify);
		if (!sandboxDirs.some(sandboxDir => isInside(pathToVerify, sandboxDir, true))) {
			throw {
				code: 'OUTSIDE_SANDBOX',
				path: pathToVerify,
				sandboxes: sandboxDirs,
				msg: `${pathToVerify} is outside the sandbox directories (${sandboxDirs.join(', ')})`,
			};
		}
	}
}

function realExistingPartOfPath(pathName) {
	try {
		return fs.realpathSync.native(pathName);
	} catch (e) {
		// Unlike the native and promises versions of realpath,
		// realpathSync's error provides the first real part of the path that didn't exist,
		// so back out one directory and we've got the part that does exist.
		return fs.realpathSync(path.dirname(e.path));
	}
}

// thanks to: https://github.com/sindresorhus/is-path-inside/blob/v4.0.0/index.js
function isInside(child, parent, inclusive = false) {
	const relative = path.relative(parent, child);
	return (
		(relative || inclusive) &&
		relative !== '..' &&
		!relative.startsWith(`..${path.sep}`) &&
		!path.isAbsolute(relative)
	);
}

module.exports = { sandbox, unbox, isBoxed };
