const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4010';

function buildHeaders(customHeaders = {}) {
  const token = localStorage.getItem('smart_gate_token');
  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function handleResponse(response) {
  if (!response.ok) {
    let errorMessage = 'Request failed';
    try {
      const data = await response.json();
      errorMessage = data.message || errorMessage;
    } catch (_error) {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/pdf')) {
    return response.blob();
  }

  return response.json();
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders(options.headers)
  });

  return handleResponse(response);
}

export { API_BASE_URL };
