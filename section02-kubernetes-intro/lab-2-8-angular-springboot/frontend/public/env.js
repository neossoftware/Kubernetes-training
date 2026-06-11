// En K8s: API_URL vacío = llamadas relativas (/api/*)
// nginx hace proxy_pass a api-svc:8080 internamente
window.__env = {
  API_URL: ''
};
