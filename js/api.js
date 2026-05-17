const API_ROOT = '/api';

// Função genérica para chamar a API do backend.
async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_ROOT}${path}`, {
        headers: {
            'Content-Type': 'application/json'
        },
        ...options
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

export async function getProducts() {
    return apiRequest('/products');
}

export async function addProduct(product) {
    return apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(product)
    });
}

export async function deleteProduct(id) {
    return apiRequest(`/products/${id}`, {
        method: 'DELETE'
    });
}

export async function updateQuantity(id, amount) {
    return apiRequest(`/products/${id}/quantity`, {
        method: 'PATCH',
        body: JSON.stringify({ amount })
    });
}

export async function updateProduct(id, data) {
    return apiRequest(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}