export function debugFormFields(block) {
  block.querySelectorAll("input, select, textarea").forEach((input) => {
    console.log(
      input.name,
      "=",
      input.value,
      "|",
      input.type,
      "|",
      input.getAttribute("form")
    );
  });
}
