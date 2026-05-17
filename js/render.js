// Renderiza a tabela de produtos na interface.
export function renderProducts(products) {

    const tbody = document.querySelector("tbody");

    tbody.innerHTML = "";

    products.forEach(product => {

        const isLowStock = product.quantity > 0 && product.quantity <= 5;
        const isZeroStock = product.quantity === 0;

        const stockLabel = isZeroStock
            ? "Sem Estoque"
            : isLowStock
                ? "Baixo Estoque"
                : "OK";

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${product.name}</td>

            <td>
                <div class="qty-control">

                    <button class="icon-btn increase-btn" data-id="${product.id}">
                        <span class="material-symbols-outlined">add</span>
                    </button>

                    <span>${product.quantity}</span>

                    <button class="icon-btn decrease-btn" data-id="${product.id}">
                        <span class="material-symbols-outlined">remove</span>
                    </button>

                </div>
            </td>

            <td>${product.sector}</td>

            <td>${stockLabel}</td>

            <td>
                <button class="icon-btn edit-btn" data-id="${product.id}">
                    <span class="material-symbols-outlined">edit</span>
                </button>

                <button class="icon-btn delete-btn" data-id="${product.id}">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}