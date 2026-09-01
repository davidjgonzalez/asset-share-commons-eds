// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import { readBlockConfig as readBlockConfigAem } from "../../../aem.js";

export function readBlockConfig(block, transform = {}, defaults = {}) {
  const config = { ...defaults, ...readBlockConfigAem(block) };

  /* Run the transform function on the config */
  Object.entries(config).forEach(([key, value]) => {
    if (transform[key]) {
      config[key] = transform[key](value);
    }
  });

  return config;
}

export function getOptions({
  content = "",
  initialValues = {},
  delimiter = ":",
  splitter = undefined,
}) {
  const items = content.split("\n").map((line) => line.trim());

  if (!splitter) {
    splitter = (s) => {
      const delimiterIndex = s.indexOf(delimiter);
      const option = {
        text:
          delimiterIndex !== -1 ? s.slice(0, delimiterIndex).trim() : s.trim(),
        value:
          delimiterIndex !== -1
            ? s.slice(delimiterIndex + delimiter.length).trim()
            : "",
      };
      return option;
    };
  }

  const options = items
    .map((item) => {
      return splitter(item);
    })
    .map((option, index) => {
      return {
        ...option,
        selected: Array.isArray(initialValues)
          ? initialValues.some(
              (iv) => iv.key === option.text && iv.value === option.value
            )
          : false,
        disabled: false,
      };
    });

  return options;
}
export function replaceTokens(scope, token, value) {
  if (!scope) return;

  const walker = document.createTreeWalker(
    scope,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const search = `{{${token}}}`;

  let node;
  while (node = walker.nextNode()) {
    if (node.nodeValue.includes(search)) {
      node.nodeValue = node.nodeValue.replaceAll(search, value);
    }
  }
}
