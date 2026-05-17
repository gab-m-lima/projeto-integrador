import {
    getProducts,
    deleteProduct,
    updateQuantity,
    updateProduct,
    addProduct
} from "./api.js";

import { renderProducts } from "./render.js";

// Front-end principal do aplicativo.
// Carrega produtos da API e controla os modais de criar/editar/excluir.
/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeApp() {
    try {
        await loadProducts();
        console.log('✓ Products loaded');
    } catch (error) {
        console.error('Failed to initialize application:', error);
    }
}

/* =========================================================
   STATE
========================================================= */

let currentDeleteId = null;
let currentEditId = null;
let modalOpen = false;

/* =========================================================
   DOM CACHE
========================================================= */

const modalContainer = document.getElementById("modal-container");

/* =========================================================
   CORE
========================================================= */

async function loadProducts() {
    const products = await getProducts();
    renderProducts(products);
    updateDashboard(products);
}

/* =========================================================
   MODAL HELPERS
========================================================= */

function openModal() {
    modalOpen = true;
}

function closeModal() {
    modalContainer.innerHTML = "";
    currentDeleteId = null;
    currentEditId = null;
    modalOpen = false;
}

/* =========================================================
   ADD PRODUCT
========================================================= */

async function openNewProductModal() {
    if (modalOpen) return;
    openModal();

    const response = await fetch("../pages/add-product.html");
    modalContainer.innerHTML = await response.text();

    const form = modalContainer.querySelector(".modal__form");

    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = document.getElementById("product-name").value;
        const sector = document.getElementById("sector").value;

        await addProduct({
            name,
            sector,
            quantity: 0
        });

        closeModal();
        loadProducts();
    });
}

/* =========================================================
   EDIT PRODUCT
========================================================= */

async function openEditModal(id) {
    if (modalOpen) return;
    openModal();

    currentEditId = id;

    const response = await fetch("../pages/edit-product.html");
    modalContainer.innerHTML = await response.text();

    const products = await getProducts();
    const product = products.find(p => Number(p.id) === Number(id));

    if (!product) return;

    const nameInput = document.getElementById("product-name");
    const sectorInput = document.getElementById("sector");

    if (nameInput) nameInput.value = product.name;
    if (sectorInput) sectorInput.value = product.sector;

    const form = modalContainer.querySelector(".modal__form");

    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = nameInput.value;
        const sector = sectorInput.value;

        await updateProduct(currentEditId, {
            name,
            sector
        });

        closeModal();
        loadProducts();
    });
}

/* =========================================================
   DELETE PRODUCT
========================================================= */

async function openDeleteModal(id) {
    if (modalOpen) return;
    openModal();

    currentDeleteId = id;

    const response = await fetch("../pages/warning-message.html");
    modalContainer.innerHTML = await response.text();

    const confirmBtn = document.getElementById("confirm-button");
    const cancelBtn = document.getElementById("cancel-button");

    confirmBtn?.addEventListener("click", async () => {
        await deleteProduct(currentDeleteId);
        closeModal();
        loadProducts();
    });

    cancelBtn?.addEventListener("click", closeModal);
}

/* =========================================================
   GLOBAL EVENTS (AÇÕES)
========================================================= */

document.addEventListener("click", async (event) => {
    // Listener global para todos os botões da interface.
    // Usa delegation para capturar ação de aumento, redução, edição e exclusão.

    const increaseBtn = event.target.closest(".increase-btn");
    if (increaseBtn) {
        await updateQuantity(Number(increaseBtn.dataset.id), 1);
        loadProducts();
        return;
    }

    const decreaseBtn = event.target.closest(".decrease-btn");
    if (decreaseBtn) {
        await updateQuantity(Number(decreaseBtn.dataset.id), -1);
        loadProducts();
        return;
    }

    const newItemBtn = event.target.closest("#add-new-product-type");
    if (newItemBtn) {
        await openNewProductModal();
        return;
    }

    const exportDbBtn = event.target.closest("#export-database");
    if (exportDbBtn) {
        await exportDatabaseToFile();
        return;
    }

    const deleteBtn = event.target.closest(".delete-btn");
    if (deleteBtn) {
        await openDeleteModal(Number(deleteBtn.dataset.id));
        return;
    }

    const editBtn = event.target.closest(".edit-btn");
    if (editBtn) {
        await openEditModal(Number(editBtn.dataset.id));
        return;
    }

    const clickedOutside = event.target === modalContainer;
    const clickedClose = event.target.closest("#close-modal");
    const clickedCancel = event.target.closest("#cancel-button");

    if (clickedOutside || clickedClose || clickedCancel) {
        closeModal();
    }
});

/* =========================================================
   DASHBOARD
========================================================= */

function updateDashboard(products) {

    const totalItems = products.reduce((acc, item) => acc + item.quantity, 0);

    const registeredItems = products.length;

    const zeroStockItems = products.filter(item => item.quantity === 0).length;

    const lowStockItems = products.filter(
        item => item.quantity > 0 && item.quantity <= 5
    ).length;

    document.getElementById("total-items").textContent = totalItems;
    document.getElementById("registered-items").textContent = registeredItems;
    document.getElementById("zero-stock-items").textContent = zeroStockItems;
    document.getElementById("low-stock-items").textContent = lowStockItems;
}

/* =========================================================
   STOCK STATUS
========================================================= */

export function getStockStatus(quantity) {
    if (quantity === 0) return "zero";
    if (quantity <= 5) return "low";
    return "ok";
}

/* =========================================================
   INIT
========================================================= */

initializeApp();