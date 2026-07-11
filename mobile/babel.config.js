module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo (SDK 54) already transpiles class fields + private
  // methods correctly for RN 0.81 + Hermes. Manually re-adding those plugins
  // overrode that with a broken mode: spec mode crashed VirtualizedList
  // ("property is not configurable"), loose mode crashed on read-only enum
  // fields ("Cannot assign to read-only property 'NONE'"). Let the preset own it.
  return {
    presets: ['babel-preset-expo'],
  };
};
