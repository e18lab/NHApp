





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


const mockCreateSerializable = (value) => value;


const mockExecuteOnUIRuntimeSync = (fn) => {
  if (typeof fn === 'function') {
    return fn();
  }
  return fn;
};


const mockIsWorkletFunction = () => false;


const mockRunOnRuntime = (runtime, fn) => {
  if (typeof fn === 'function') {
    return fn();
  }
  return fn;
};


const mockSerializableMappingCache = new Map();


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
  makeShareableCloneRecursive: mockCreateSerializable, 
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
