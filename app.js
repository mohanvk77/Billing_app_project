document.addEventListener('DOMContentLoaded', async () => {
    // === Application State ===
    let currentTheme = localStorage.getItem('theme') || 'light';
    let posCart = [];
    let customers = [];
    let products = [];
    let databaseReady = false;
    let salesChartInstance = null;
    
    // === DOM Elements ===
    const body = document.documentElement;
    const themeToggleBtn = document.getElementById('theme-toggle');
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    
    // Modals
    const modalProduct = document.getElementById('modal-product');
    const modalCustomer = document.getElementById('modal-customer');
    const modalInvoice = document.getElementById('modal-invoice');
    const closeBtns = document.querySelectorAll('.close-modal');
    
    // Forms
    const formProduct = document.getElementById('form-product');
    const formCustomer = document.getElementById('form-customer');
    
    // POS Elements
    const posCustomerSelect = document.getElementById('pos-customer');
    const posSearchInput = document.getElementById('pos-search');
    const posProductList = document.getElementById('pos-product-list');
    const posCartItems = document.getElementById('pos-cart-items');
    const posSubtotalEl = document.getElementById('pos-subtotal');
    const posTotalEl = document.getElementById('pos-total');
    const posCheckoutBtn = document.getElementById('pos-checkout-btn');

    // Excel Upload
    const excelUpload = document.getElementById('excel-upload');
    const importLog = document.getElementById('import-log');

    // === Initialization ===
    applyTheme(currentTheme);
    setupEventListeners();

    try {
        await db.init();
        databaseReady = true;
        await loadInitialData();
    } catch (error) {
        console.error("Failed to initialize database:", error);
        showDatabaseError();
        alert("Failed to initialize database: " + error);
    }

    // === Event Listeners ===
    function setupEventListeners() {
        // Theme
        themeToggleBtn.addEventListener('click', async () => {
            currentTheme = currentTheme === 'light' ? 'dark' : 'light';
            localStorage.setItem('theme', currentTheme);
            applyTheme(currentTheme);
            if (databaseReady) {
                const bills = await db.getAll('bills') || [];
                renderSalesChart(bills);
            }
        });

        // Navigation
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = item.getAttribute('data-target');
                
                // Update active nav
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Update active view
                views.forEach(view => view.classList.remove('active'));
                document.getElementById(targetId).classList.add('active');
                
                // Refresh data based on view
                if (!databaseReady) return;
                if(targetId === 'view-dashboard') runSafely(loadDashboardData);
                if(targetId === 'view-pos') runSafely(populatePOSCustomers);
                if(targetId === 'view-products') runSafely(loadProductsData);
                if(targetId === 'view-customers') runSafely(loadCustomersData);
                if(targetId === 'view-purchases') runSafely(populateStockProducts);
            });
        });

        // View History Navigation (Header)
        const viewHistoryBtn = document.getElementById('btn-view-history');
        if (viewHistoryBtn) {
            viewHistoryBtn.addEventListener('click', () => {
                navItems.forEach(nav => nav.classList.remove('active'));
                views.forEach(view => view.classList.remove('active'));
                document.getElementById('view-history').classList.add('active');
                if (databaseReady) runSafely(loadHistoryData);
            });
        }

        // View History Navigation (Dashboard View All)
        const viewAllBtn = document.getElementById('btn-dashboard-view-all');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                navItems.forEach(nav => nav.classList.remove('active'));
                views.forEach(view => view.classList.remove('active'));
                document.getElementById('view-history').classList.add('active');
                if (databaseReady) runSafely(loadHistoryData);
            });
        }

        // History Filters
        const historySearch = document.getElementById('history-search');
        const historyDateFilter = document.getElementById('history-filter-date');
        
        if (historySearch) {
            historySearch.addEventListener('input', filterAndRenderHistory);
        }
        if (historyDateFilter) {
            historyDateFilter.addEventListener('change', filterAndRenderHistory);
        }

        // Modals Open
        document.getElementById('btn-add-product').addEventListener('click', () => {
            document.getElementById('product-id').value = '';
            formProduct.reset();
            document.getElementById('product-stock').previousElementSibling.innerText = 'Initial Stock Quantity';
            document.getElementById('product-modal-title').innerText = 'Add Product';
            openModal(modalProduct);
        });

        document.getElementById('btn-add-customer').addEventListener('click', () => {
            document.getElementById('customer-id').value = '';
            formCustomer.reset();
            document.getElementById('customer-modal-title').innerText = 'Add Customer';
            openModal(modalCustomer);
        });

        // Modals Close
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                closeModal(modalProduct);
                closeModal(modalCustomer);
                closeModal(modalInvoice);
                const custHistModal = document.getElementById('modal-customer-history');
                if (custHistModal) closeModal(custHistModal);
            });
        });

        // Forms Submit
        formProduct.addEventListener('submit', handleProductSubmit);
        formCustomer.addEventListener('submit', handleCustomerSubmit);

        // POS Search
        posSearchInput.addEventListener('input', handlePOSSearch);

        // POS Checkout
        posCheckoutBtn.addEventListener('click', handleCheckout);
        
        // POS Customer Select change
        posCustomerSelect.addEventListener('change', updateCheckoutBtnState);

        // Excel Upload
        if(excelUpload) {
            excelUpload.addEventListener('change', handleExcelUpload);
        }

        // Manual Stock Form
        const formManualStock = document.getElementById('form-manual-stock');
        if (formManualStock) {
            formManualStock.addEventListener('submit', handleManualStockSubmit);
        }

        // Print Invoice
        document.getElementById('btn-print-invoice').addEventListener('click', () => {
            window.print();
        });
    }

    // === Core Functions ===
    async function loadInitialData() {
        await runSafely(loadDashboardData);
        await runSafely(loadCustomersData);
        await runSafely(loadProductsData);
        await runSafely(populatePOSCustomers);
        renderPOSProducts(products);
    }

    async function runSafely(task) {
        try {
            return await task();
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    function showDatabaseError() {
        const message = '<div class="empty-state">Storage is not available. Navigation still works, but saved data cannot be loaded.</div>';
        document.getElementById('recent-bills-list').innerHTML = message;
        document.getElementById('products-list').innerHTML = message;
        document.getElementById('customers-list').innerHTML = message;
    }

    function applyTheme(theme) {
        body.setAttribute('data-theme', theme);
        const icon = themeToggleBtn.querySelector('i');
        icon.className = theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
    }

    function openModal(modal) {
        modal.classList.add('active');
    }

    function closeModal(modal) {
        modal.classList.remove('active');
    }

    // === Dashboard Logic ===
    async function loadDashboardData() {
        const bills = await db.getAll('bills') || [];
        const customersList = await db.getAll('customers') || [];
        products = await db.getAll('products') || []; // Ensure products are loaded
        
        // Calculate Today's Sales
        const today = new Date().toDateString();
        const todaysBills = bills.filter(b => new Date(b.date).toDateString() === today);
        const todayTotal = todaysBills.reduce((sum, bill) => sum + bill.total, 0);

        // Calculate This Month's Sales
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const monthBills = bills.filter(b => {
            const d = new Date(b.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        const monthTotal = monthBills.reduce((sum, bill) => sum + bill.total, 0);

        document.getElementById('stat-sales').innerText = `₹${todayTotal.toFixed(2)}`;
        document.getElementById('stat-sales-month').innerText = `₹${monthTotal.toFixed(2)}`;
        document.getElementById('stat-bills').innerText = bills.length;
        document.getElementById('stat-customers').innerText = customersList.length;

        // --- Low Stock Alerts ---
        const lowStockList = document.getElementById('low-stock-list');
        const lowStockItems = products.filter(p => (p.stock || 0) <= 5);
        if (lowStockItems.length === 0) {
            lowStockList.innerHTML = '<div class="empty-state">All items well stocked</div>';
        } else {
            lowStockList.innerHTML = lowStockItems.map(p => `
                <div class="list-item">
                    <span>${p.name}</span>
                    <span class="stock-badge low">Stock: ${p.stock || 0}</span>
                </div>
            `).join('');
        }

        // --- Top Selling Items ---
        const topSellingList = document.getElementById('top-selling-list');
        const salesMap = {};
        bills.forEach(bill => {
            if (bill.items) {
                bill.items.forEach(item => {
                    const name = item.product.name;
                    salesMap[name] = (salesMap[name] || 0) + item.qty;
                });
            }
        });
        
        const sortedSales = Object.entries(salesMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        if (sortedSales.length === 0) {
            topSellingList.innerHTML = '<div class="empty-state">No sales yet</div>';
        } else {
            topSellingList.innerHTML = sortedSales.map(([name, qty]) => `
                <div class="list-item">
                    <span>${name}</span>
                    <strong>${qty} sold</strong>
                </div>
            `).join('');
        }

        // --- Sales Trend Chart ---
        renderSalesChart(bills);

        // Recent Bills (on Dashboard)
        const recentBills = bills.sort((a,b) => b.date - a.date).slice(0, 5);
        const container = document.getElementById('recent-bills-list');
        
        if (recentBills.length === 0) {
            container.innerHTML = '<div class="empty-state">No recent activity</div>';
            return;
        }

        container.innerHTML = recentBills.map(bill => {
            const customer = customersList.find(c => c.id === Number(bill.customerId));
            const customerName = customer ? customer.name : 'Walk-in Customer';
            return `
                <div class="list-item">
                    <div class="item-details">
                        <h4>${customerName}</h4>
                        <p>${new Date(bill.date).toLocaleString()} • ${bill.items.length} items</p>
                    </div>
                    <div class="item-actions">
                        <strong style="margin-right: 10px;">₹${bill.total.toFixed(2)}</strong>
                        <button class="icon-btn" onclick="window.viewInvoiceDirect(${bill.id})" title="View Invoice"><i class="ph ph-eye"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderSalesChart(bills) {
        const canvas = document.getElementById('sales-chart');
        if (!canvas) return;

        // Destroy previous instance
        if (salesChartInstance) {
            salesChartInstance.destroy();
        }

        // Get dates for the last 7 days
        const labels = [];
        const salesData = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            labels.push(d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
            
            // Sum sales for this day
            const dayStart = new Date(d.setHours(0,0,0,0)).getTime();
            const dayEnd = new Date(d.setHours(23,59,59,999)).getTime();
            
            const dayBills = bills.filter(b => b.date >= dayStart && b.date <= dayEnd);
            const dayTotal = dayBills.reduce((sum, bill) => sum + bill.total, 0);
            salesData.push(dayTotal);
        }

        const isDark = currentTheme === 'dark';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
        const textColor = isDark ? '#9CA3AF' : '#4B5563';
        const primaryColor = isDark ? '#6366F1' : '#4F46E5';

        const ctx = canvas.getContext('2d');
        salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Sales (₹)',
                    data: salesData,
                    borderColor: primaryColor,
                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(79, 70, 229, 0.05)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2,
                    pointBackgroundColor: primaryColor,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Sales: ₹${context.raw.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: textColor,
                            font: {
                                family: 'Outfit'
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: textColor,
                            font: {
                                family: 'Outfit'
                            },
                            callback: function(value) {
                                return '₹' + value;
                            }
                        }
                    }
                }
            }
        });
    }

    window.viewInvoiceDirect = async (id) => {
        const bills = await db.getAll('bills') || [];
        const bill = bills.find(b => b.id === Number(id));
        if(bill) {
            generateInvoicePreview(bill, bill.id);
            openModal(modalInvoice);
        }
    };

    // === Product Logic ===
    async function loadProductsData() {
        products = await db.getAll('products') || [];
        const container = document.getElementById('products-list');
        
        if (products.length === 0) {
            container.innerHTML = '<div class="empty-state">No products found</div>';
            return;
        }

        container.innerHTML = products.map(p => `
            <div class="list-item">
                <div class="item-details">
                    <h4>${p.name}</h4>
                    <p>SKU: ${p.sku || 'N/A'} • <span class="stock-badge ${p.stock <= 5 ? 'low' : ''}">Stock: ${p.stock || 0}</span></p>
                </div>
                <div class="item-actions">
                    <strong style="margin-right: 10px;">₹${p.price.toFixed(2)}</strong>
                    <button class="icon-btn" onclick="window.editProduct(${p.id})"><i class="ph ph-pencil"></i></button>
                    <button class="icon-btn btn-danger" onclick="window.deleteProduct(${p.id})"><i class="ph ph-trash"></i></button>
                </div>
            </div>
        `).join('');
    }

    async function handleProductSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('product-id').value;
        const data = {
            name: document.getElementById('product-name').value,
            price: parseFloat(document.getElementById('product-price').value),
            sku: document.getElementById('product-sku').value,
            stock: parseInt(document.getElementById('product-stock').value) || 0
        };

        if (id) {
            data.id = Number(id);
            await db.update('products', data);
        } else {
            await db.add('products', data);
        }

        closeModal(modalProduct);
        loadProductsData();
        renderPOSProducts(products);
    }

    window.editProduct = async (id) => {
        const product = await db.get('products', id);
        if(product) {
            document.getElementById('product-id').value = product.id;
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-price').value = product.price;
            document.getElementById('product-sku').value = product.sku;
            document.getElementById('product-stock').value = product.stock || 0;
            document.getElementById('product-stock').previousElementSibling.innerText = 'Current Stock Quantity';
            document.getElementById('product-modal-title').innerText = 'Edit Product';
            openModal(modalProduct);
        }
    };

    window.deleteProduct = async (id) => {
        if(confirm('Are you sure you want to delete this product?')) {
            await db.delete('products', id);
            loadProductsData();
            renderPOSProducts(products);
        }
    };

    // === Customer Logic ===
    async function loadCustomersData() {
        customers = await db.getAll('customers') || [];
        const container = document.getElementById('customers-list');
        
        if (customers.length === 0) {
            container.innerHTML = '<div class="empty-state">No customers found</div>';
            return;
        }

        container.innerHTML = customers.map(c => `
            <div class="list-item">
                <div class="item-details">
                    <h4>${c.name}</h4>
                    <p>${c.phone} ${c.email ? '• ' + c.email : ''}</p>
                </div>
                <div class="item-actions">
                    <button class="icon-btn" onclick="window.viewCustomerHistory(${c.id})" title="Purchase History"><i class="ph ph-clock"></i></button>
                    <button class="icon-btn" onclick="window.editCustomer(${c.id})"><i class="ph ph-pencil"></i></button>
                    <button class="icon-btn btn-danger" onclick="window.deleteCustomer(${c.id})"><i class="ph ph-trash"></i></button>
                </div>
            </div>
        `).join('');
    }

    async function handleCustomerSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('customer-id').value;
        const data = {
            name: document.getElementById('customer-name').value,
            phone: document.getElementById('customer-phone').value,
            email: document.getElementById('customer-email').value
        };

        if (id) {
            data.id = Number(id);
            await db.update('customers', data);
        } else {
            await db.add('customers', data);
        }

        closeModal(modalCustomer);
        loadCustomersData();
        populatePOSCustomers(); // Refresh POS select
    }

    window.editCustomer = async (id) => {
        const customer = await db.get('customers', id);
        if(customer) {
            document.getElementById('customer-id').value = customer.id;
            document.getElementById('customer-name').value = customer.name;
            document.getElementById('customer-phone').value = customer.phone;
            document.getElementById('customer-email').value = customer.email;
            document.getElementById('customer-modal-title').innerText = 'Edit Customer';
            openModal(modalCustomer);
        }
    };

    window.deleteCustomer = async (id) => {
        if(confirm('Are you sure you want to delete this customer?')) {
            await db.delete('customers', id);
            loadCustomersData();
            populatePOSCustomers();
        }
    };

    // === POS Logic ===
    async function populatePOSCustomers() {
        const custs = await db.getAll('customers') || [];
        posCustomerSelect.innerHTML = '<option value="">Walk-in Customer</option>' + 
            custs.map(c => `<option value="${c.id}">${c.name} (${c.phone})</option>`).join('');
    }

    function renderPOSProducts(productsToRender) {
        if(!posProductList) return;
        if(productsToRender.length === 0) {
            posProductList.innerHTML = '<div class="empty-state">No products found</div>';
            return;
        }

        posProductList.innerHTML = productsToRender.map(p => {
            const stockLevel = p.stock || 0;
            return `
            <div class="pos-product-card" onclick="window.addToCart(${p.id})">
                <div class="pos-product-name">${p.name}</div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="pos-product-price">₹${p.price.toFixed(2)}</div>
                    <div class="stock-badge ${stockLevel <= 5 ? 'low' : ''}">${stockLevel} in stock</div>
                </div>
            </div>
            `;
        }).join('');
    }

    function handlePOSSearch(e) {
        const query = e.target.value.toLowerCase().trim();
        if(!query) {
            renderPOSProducts(products);
            return;
        }

        const matches = products.filter(p => 
            p.name.toLowerCase().includes(query) || 
            (p.sku && p.sku.toLowerCase().includes(query))
        );

        renderPOSProducts(matches);
    }

    window.addToCart = (productId) => {
        const product = products.find(p => p.id === productId);
        if(!product) return;

        const existingItem = posCart.find(item => item.product.id === productId);
        
        // Check stock
        const currentQty = existingItem ? existingItem.qty : 0;
        if(currentQty + 1 > (product.stock || 0)) {
            alert(`Cannot add more. Only ${product.stock || 0} in stock.`);
            return;
        }

        if(existingItem) {
            existingItem.qty += 1;
        } else {
            posCart.push({ product, qty: 1 });
        }

        posSearchInput.value = '';
        renderPOSProducts(products); // Reset search when added
        renderCart();
    };

    window.updateCartQty = (index, delta) => {
        const item = posCart[index];
        if (delta > 0 && item.qty + delta > (item.product.stock || 0)) {
            alert(`Cannot add more. Only ${item.product.stock || 0} in stock.`);
            return;
        }

        item.qty += delta;
        if(item.qty <= 0) {
            posCart.splice(index, 1);
        }
        renderCart();
    };

    function renderCart() {
        if(posCart.length === 0) {
            posCartItems.innerHTML = '<div class="empty-state">Cart is empty</div>';
            posSubtotalEl.innerText = '₹0.00';
            posTotalEl.innerText = '₹0.00';
            updateCheckoutBtnState();
            return;
        }

        let total = 0;
        posCartItems.innerHTML = posCart.map((item, index) => {
            const itemTotal = item.product.price * item.qty;
            total += itemTotal;
            return `
                <div class="cart-item">
                    <div class="cart-item-details">
                        <div class="cart-item-title">${item.product.name}</div>
                        <div class="cart-item-price">₹${item.product.price.toFixed(2)}</div>
                    </div>
                    <div class="cart-item-qty">
                        <button class="qty-btn" onclick="window.updateCartQty(${index}, -1)">-</button>
                        <span>${item.qty}</span>
                        <button class="qty-btn" onclick="window.updateCartQty(${index}, 1)">+</button>
                    </div>
                    <div class="cart-item-total">₹${itemTotal.toFixed(2)}</div>
                </div>
            `;
        }).join('');

        posSubtotalEl.innerText = `₹${total.toFixed(2)}`;
        posTotalEl.innerText = `₹${total.toFixed(2)}`;
        updateCheckoutBtnState();
    }

    function updateCheckoutBtnState() {
        posCheckoutBtn.disabled = posCart.length === 0;
    }

    async function handleCheckout() {
        if(posCart.length === 0) return;

        const customerId = posCustomerSelect.value;
        const total = posCart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
        
        const bill = {
            customerId: customerId || null,
            items: posCart,
            total: total,
            date: Date.now()
        };

        const billId = await db.add('bills', bill);
        
        // Deduct stock from products
        for(let item of posCart) {
            const product = await db.get('products', item.product.id);
            if(product) {
                product.stock = (product.stock || 0) - item.qty;
                await db.update('products', product);
            }
        }
        
        // Refresh products globally to reflect new stock
        await loadProductsData();

        // Show Invoice Preview
        generateInvoicePreview(bill, billId);
        openModal(modalInvoice);

        // Reset POS
        posCart = [];
        posCustomerSelect.value = '';
        renderCart();
        loadDashboardData(); // Update dashboard stats
    }

    async function generateInvoicePreview(bill, billId) {
        let customerName = "Walk-in Customer";
        let customerPhone = "";
        
        if (bill.customerId) {
            const cust = await db.get('customers', Number(bill.customerId));
            if (cust) {
                customerName = cust.name;
                customerPhone = cust.phone;
            }
        }

        const date = new Date(bill.date).toLocaleString();

        const itemsHtml = bill.items.map(item => `
            <tr>
                <td>${item.product.name}</td>
                <td class="right">${item.qty}</td>
                <td class="right">₹${(item.product.price * item.qty).toFixed(2)}</td>
            </tr>
        `).join('');

        const html = `
            <div class="receipt-header">
                <h2>Billio Invoice</h2>
                <div>Invoice #${billId}</div>
                <div>${date}</div>
                <div style="margin-top:10px;">
                    <strong>Billed To:</strong><br>
                    ${customerName}<br>
                    ${customerPhone}
                </div>
            </div>
            <table class="receipt-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th class="right">Qty</th>
                        <th class="right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            <div class="receipt-footer">
                <div class="receipt-total">
                    <span>Total Paid:</span>
                    <span>₹${bill.total.toFixed(2)}</span>
                </div>
                <div style="text-align:center; margin-top:20px; font-size:0.8rem; color:#666;">
                    Thank you for your business!
                </div>
            </div>
        `;

        document.getElementById('invoice-receipt').innerHTML = html;
    }

    // === Excel Import Logic ===
    async function handleExcelUpload(e) {
        const file = e.target.files[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                
                // Get first sheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convert to JSON
                const json = XLSX.utils.sheet_to_json(worksheet);
                
                let updatedCount = 0;
                let addedCount = 0;

                for(let row of json) {
                    // Try to map columns generically
                    const name = row['Product Name'] || row['Name'] || row['product_name'] || row['Item'];
                    const qty = parseInt(row['Quantity'] || row['Qty'] || row['Stock'] || row['stock']) || 0;
                    const price = parseFloat(row['Price'] || row['price'] || row['Cost']) || 0;
                    const sku = row['SKU'] || row['sku'] || row['Barcode'] || '';

                    if(!name) continue; // Skip if no name

                    // Check if product exists by Name or SKU
                    const existingProduct = products.find(p => 
                        p.name.toLowerCase() === name.toLowerCase() || 
                        (sku && p.sku && p.sku.toLowerCase() === sku.toLowerCase())
                    );

                    if(existingProduct) {
                        existingProduct.stock = (existingProduct.stock || 0) + qty;
                        if(row['Price']) existingProduct.price = price; // Update price if provided
                        await db.update('products', existingProduct);
                        updatedCount++;
                    } else {
                        const newProduct = {
                            name: name,
                            price: price,
                            sku: sku.toString(),
                            stock: qty
                        };
                        await db.add('products', newProduct);
                        addedCount++;
                    }
                }

                // Refresh data
                await loadProductsData();
                renderPOSProducts(products);

                // Update UI log
                const logItem = document.createElement('div');
                logItem.className = 'list-item';
                logItem.innerHTML = `
                    <div class="item-details">
                        <h4>${file.name}</h4>
                        <p>${new Date().toLocaleString()}</p>
                    </div>
                    <div class="item-actions">
                        <strong style="color:var(--success-color)">+${addedCount} New, ${updatedCount} Updated</strong>
                    </div>
                `;
                
                if(importLog.querySelector('.empty-state')) {
                    importLog.innerHTML = '';
                }
                importLog.prepend(logItem);
                
                alert(`Successfully imported! \nAdded: ${addedCount} \nUpdated: ${updatedCount}`);
                
            } catch(error) {
                console.error(error);
                alert('Error parsing Excel file. Please ensure it has standard column headers.');
            } finally {
                // Reset file input
                excelUpload.value = '';
            }
        };
        
        reader.readAsArrayBuffer(file);
    }

    // === Manual Stock Update Logic ===
    async function populateStockProducts() {
        const prods = await db.getAll('products') || [];
        const select = document.getElementById('manual-stock-product');
        if (!select) return;

        select.innerHTML = '<option value="">Select a product...</option>' +
            prods.map(p => `<option value="${p.id}">
                ${p.name} — ₹${p.price.toFixed(2)} (Stock: ${p.stock || 0})
            </option>`).join('');
    }

    async function handleManualStockSubmit(e) {
        e.preventDefault();
        const productId = Number(document.getElementById('manual-stock-product').value);
        const qty = parseInt(document.getElementById('manual-stock-qty').value) || 0;
        const newPrice = document.getElementById('manual-stock-price').value;

        if (!productId || qty <= 0) {
            alert('Please select a product and enter a valid quantity.');
            return;
        }

        const product = await db.get('products', productId);
        if (!product) {
            alert('Product not found.');
            return;
        }

        product.stock = (product.stock || 0) + qty;
        if (newPrice !== '' && !isNaN(parseFloat(newPrice))) {
            product.price = parseFloat(newPrice);
        }

        await db.update('products', product);

        // Update global products list
        await loadProductsData();
        renderPOSProducts(products);
        await populateStockProducts(); // Refresh the dropdown to show new stock

        // Log the manual entry
        const importLog = document.getElementById('import-log');
        if (importLog) {
            const logItem = document.createElement('div');
            logItem.className = 'list-item';
            logItem.innerHTML = `
                <div class="item-details">
                    <h4>${product.name}</h4>
                    <p>${new Date().toLocaleString()}</p>
                </div>
                <div class="item-actions">
                    <strong style="color: var(--primary-color)">+${qty} (Manual)</strong>
                </div>
            `;
            if (importLog.querySelector('.empty-state')) {
                importLog.innerHTML = '';
            }
            importLog.prepend(logItem);
        }

        // Reset form
        document.getElementById('form-manual-stock').reset();
        alert(`Stock updated! ${product.name} now has ${product.stock} units.`);
    }

    // === Bill History Logic ===
    let allBills = [];

    async function loadHistoryData() {
        allBills = await db.getAll('bills') || [];
        await filterAndRenderHistory();
    }

    async function filterAndRenderHistory() {
        const query = document.getElementById('history-search').value.toLowerCase().trim();
        const dateFilter = document.getElementById('history-filter-date').value;
        const container = document.getElementById('history-list');
        const custs = await db.getAll('customers') || [];

        // Apply filters
        let filtered = [...allBills];

        // Date Filter
        const now = new Date();
        if (dateFilter === 'today') {
            const todayStr = now.toDateString();
            filtered = filtered.filter(b => new Date(b.date).toDateString() === todayStr);
        } else if (dateFilter === '7days') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(now.getDate() - 7);
            filtered = filtered.filter(b => b.date >= sevenDaysAgo.getTime());
        } else if (dateFilter === 'month') {
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            filtered = filtered.filter(b => {
                const d = new Date(b.date);
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            });
        }

        // Search Filter (Invoice ID or Customer Name)
        if (query) {
            filtered = filtered.filter(b => {
                const billIdMatch = b.id.toString().includes(query);
                const customer = custs.find(c => c.id === Number(b.customerId));
                const customerNameMatch = customer && customer.name.toLowerCase().includes(query);
                const walkInMatch = !b.customerId && 'walk-in customer'.includes(query);
                return billIdMatch || customerNameMatch || walkInMatch;
            });
        }

        // Calculate Totals
        const totalAmount = filtered.reduce((sum, b) => sum + b.total, 0);
        document.getElementById('history-filtered-total').innerText = `₹${totalAmount.toFixed(2)}`;
        document.getElementById('history-filtered-count').innerText = filtered.length;

        // Render List
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">No bills match the criteria</div>';
            return;
        }

        // Sort descending by date
        filtered.sort((a, b) => b.date - a.date);

        container.innerHTML = filtered.map(bill => {
            const customer = custs.find(c => c.id === Number(bill.customerId));
            const customerName = customer ? customer.name : 'Walk-in Customer';
            const customerPhone = customer ? ` (${customer.phone})` : '';
            return `
                <div class="list-item">
                    <div class="item-details">
                        <h4>Invoice #${bill.id}</h4>
                        <p style="margin: 0.15rem 0;"><strong>Billed to:</strong> ${customerName}${customerPhone}</p>
                        <p>${new Date(bill.date).toLocaleString()} • ${bill.items.length} items</p>
                    </div>
                    <div class="item-actions" style="align-items: center;">
                        <strong style="font-size: 1.1rem; margin-right: 0.5rem;">₹${bill.total.toFixed(2)}</strong>
                        <button class="icon-btn" onclick="window.viewInvoiceDirect(${bill.id})" title="View Invoice"><i class="ph ph-eye"></i></button>
                        <button class="icon-btn btn-danger" onclick="window.deleteBill(${bill.id})" title="Delete Bill"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.deleteBill = async (id) => {
        if (confirm('Are you sure you want to delete this bill? This will refund the item stock levels.')) {
            const bill = await db.get('bills', id);
            if (bill) {
                // Refund Stock
                for (let item of bill.items) {
                    const product = await db.get('products', item.product.id);
                    if (product) {
                        product.stock = (product.stock || 0) + item.qty;
                        await db.update('products', product);
                    }
                }
                
                // Delete Bill
                await db.delete('bills', id);
                
                // Refresh Views
                await loadHistoryData();
                await loadProductsData();
                await loadDashboardData();
                alert('Bill deleted and stock refunded successfully.');
            }
        }
    };

    window.viewCustomerHistory = async (id) => {
        const customer = await db.get('customers', id);
        if (!customer) return;

        const bills = await db.getAll('bills') || [];
        const customerBills = bills.filter(b => Number(b.customerId) === Number(id));

        // Calculate metrics
        const totalSpent = customerBills.reduce((sum, b) => sum + b.total, 0);
        const count = customerBills.length;
        const avgBill = count > 0 ? totalSpent / count : 0;

        // Set Details
        document.getElementById('cust-profile-name').innerText = customer.name;
        document.getElementById('cust-profile-contact').innerText = `${customer.phone} ${customer.email ? '• ' + customer.email : ''}`;
        document.getElementById('cust-metric-spent').innerText = `₹${totalSpent.toFixed(2)}`;
        document.getElementById('cust-metric-count').innerText = count;
        document.getElementById('cust-metric-avg').innerText = `₹${avgBill.toFixed(2)}`;

        // Render customer bills
        const container = document.getElementById('cust-profile-bills');
        if (customerBills.length === 0) {
            container.innerHTML = '<div class="empty-state">No purchases recorded</div>';
        } else {
            // Sort descending by date
            customerBills.sort((a, b) => b.date - a.date);
            container.innerHTML = customerBills.map(bill => `
                <div class="list-item" style="padding: 0.75rem; border-radius: var(--radius-md); background: var(--surface-solid); border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; font-size: 0.9rem;">
                    <div>
                        <strong style="display: block;">Invoice #${bill.id}</strong>
                        <span style="font-size: 0.8rem; color: var(--text-secondary);">${new Date(bill.date).toLocaleString()}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <strong>₹${bill.total.toFixed(2)}</strong>
                        <button class="icon-btn" onclick="window.viewInvoiceDirect(${bill.id})" title="View Invoice"><i class="ph ph-eye"></i></button>
                    </div>
                </div>
            `).join('');
        }

        openModal(document.getElementById('modal-customer-history'));
    };
});
