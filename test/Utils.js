let contextFactory;

export function observeVariables(variables) {
  contextFactory = e => {
    e.preventDefault();
    e.detail.variables = variables;
  };
  window.addEventListener('environment-current', contextFactory);
}

export function unobserveVariables() {
  window.removeEventListener('environment-current', contextFactory);
}
