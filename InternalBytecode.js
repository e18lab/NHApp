// This file exists to prevent Metro symbolication errors like:
//   ENOENT: no such file or directory, open '.../InternalBytecode.js'
// Some Hermes stack traces refer to "InternalBytecode.js"; Metro then tries to
// read it when generating code frames. Keeping an empty placeholder avoids
// noisy ENOENT logs during development.

export {};

