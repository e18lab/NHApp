// Mock worklets module for web platform
// This prevents worklets from being used on web where they cause errors
// Metro config will route react-native-worklets to this file on web platform

// Return a mock worklets implementation that just passes through functions
// On web, worklets run as regular JS functions anyway
const mockWorklet = (fn) => {
  if (typeof fn === 'function') {
    return fn;
  }
  return fn;
};

const mockRunOnJS = (fn) => {
  if (typeof fn === 'function') {
    return (...args) => fn(...args);
  }
  return fn;
};

const mockRunOnUI = (fn) => {
  if (typeof fn === 'function') {
    return (...args) => fn(...args);
  }
  return fn;
};

const mockRuntime = {
  runOnUI: mockRunOnUI,
  runOnJS: mockRunOnJS,
};

// createSerializable - on web, just returns the value as-is
const mockCreateSerializable = (value) => value;

// executeOnUIRuntimeSync - on web, just executes synchronously
const mockExecuteOnUIRuntimeSync = (fn) => {
  if (typeof fn === 'function') {
    return fn();
  }
  return fn;
};

// isWorkletFunction - on web, always returns false (no real worklets)
const mockIsWorkletFunction = () => false;

// runOnRuntime - on web, just executes the function
const mockRunOnRuntime = (runtime, fn) => {
  if (typeof fn === 'function') {
    return fn();
  }
  return fn;
};

// serializableMappingCache - on web, use a simple Map
const mockSerializableMappingCache = new Map();

// RuntimeKind enum (if needed)
const RuntimeKind = {
  UI: 'UI',
  JS: 'JS',
};

module.exports = {
  createWorklet: mockWorklet,
  runOnJS: mockRunOnJS,
  runOnUI: mockRunOnUI,
  createSerializable: mockCreateSerializable,
  executeOnUIRuntimeSync: mockExecuteOnUIRuntimeSync,
  isWorkletFunction: mockIsWorkletFunction,
  runOnRuntime: mockRunOnRuntime,
  makeShareableCloneRecursive: mockCreateSerializable, // alias for createSerializable
  serializableMappingCache: mockSerializableMappingCache,
  RuntimeKind: RuntimeKind,
  createWorkletRuntime: () => mockRuntime,
  WorkletsModule: {
    createWorklet: mockWorklet,
    runOnJS: mockRunOnJS,
    runOnUI: mockRunOnUI,
    createSerializable: mockCreateSerializable,
    executeOnUIRuntimeSync: mockExecuteOnUIRuntimeSync,
    isWorkletFunction: mockIsWorkletFunction,
    runOnRuntime: mockRunOnRuntime,
    makeShareableCloneRecursive: mockCreateSerializable,
    serializableMappingCache: mockSerializableMappingCache,
    RuntimeKind: RuntimeKind,
  },
  default: {
    createWorklet: mockWorklet,
    runOnJS: mockRunOnJS,
    runOnUI: mockRunOnUI,
    createSerializable: mockCreateSerializable,
    executeOnUIRuntimeSync: mockExecuteOnUIRuntimeSync,
    isWorkletFunction: mockIsWorkletFunction,
    runOnRuntime: mockRunOnRuntime,
    makeShareableCloneRecursive: mockCreateSerializable,
    serializableMappingCache: mockSerializableMappingCache,
    RuntimeKind: RuntimeKind,
    createWorkletRuntime: () => mockRuntime,
  },
};
