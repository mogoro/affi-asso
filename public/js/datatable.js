/**
 * AFFI DataTable — Excel-like table component
 * Usage: new DataTable(containerId, { columns, data, actions, pageSize })
 */

/* Utility: HTML-escape */
function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

class DataTable {
    constructor(containerId, options) {
        this.container = document.getElementById(containerId);
        this.columns = options.columns || [];   // [{key, label, sortable, filterable, type, render, width}]
        this.allData = options.data || [];
        this.actions = options.actions || null;  // function(row) => HTML string
        this.pageSize = options.pageSize || 25;
        this.currentPage = 1;
        this.sortKey = null;
        this.sortDir = 'asc';
        this.filters = {};
        this.selectedRows = new Set();
        this.searchText = '';
        this.onExport = options.onExport || null;
        this.onSelectionChange = options.onSelectionChange || null;
        this.render();
    }

    get filteredData() {
        let data = [...this.allData];
        // Global search
        if (this.searchText) {
            const s = this.searchText.toLowerCase();
            data = data.filter(row =>
                this.columns.some(col =>
                    String(row[col.key] || '').toLowerCase().includes(s)
                )
            );
        }
        // Per-column filters
        for (const [key, val] of Object.entries(this.filters)) {
            if (val) data = data.filter(row => String(row[key] || '').toLowerCase().includes(val.toLowerCase()));
        }
        // Sort
        if (this.sortKey) {
            const col = this.columns.find(c => c.key === this.sortKey);
            data.sort((a, b) => {
                let va = a[this.sortKey] ?? '', vb = b[this.sortKey] ?? '';
                if (col && col.type === 'date') {
                    va = new Date(va).getTime() || 0;
                    vb = new Date(vb).getTime() || 0;
                } else if (col && col.type === 'number') {
                    va = parseFloat(va) || 0;
                    vb = parseFloat(vb) || 0;
                } else {
                    va = String(va).toLowerCase();
                    vb = String(vb).toLowerCase();
                }
                if (va < vb) return this.sortDir === 'asc' ? -1 : 1;
                if (va > vb) return this.sortDir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return data;
    }

    get pagedData() {
        const start = (this.currentPage - 1) * this.pageSize;
        return this.filteredData.slice(start, start + this.pageSize);
    }

    get totalPages() {
        return Math.max(1, Math.ceil(this.filteredData.length / this.pageSize));
    }

    setData(data) {
        this.allData = data;
        this.currentPage = 1;
        this.selectedRows.clear();
        this.render();
    }

    render() {
        if (!this.container) return;
        const filtered = this.filteredData;
        const paged = this.pagedData;

        this.container.innerHTML = `
            <div class="dt-wrapper">
                <div class="dt-toolbar">
                    <div class="dt-toolbar-left">
                        <div class="dt-search">
                            <span class="dt-search-icon">&#128269;</span>
                            <input type="text" class="dt-search-input" placeholder="Rechercher..." value="${this.searchText}" />
                        </div>
                        <span class="dt-count">${filtered.length} résultat(s)</span>
                    </div>
                    <div class="dt-toolbar-right">
                        <select class="dt-page-size">
                            ${[10,25,50,100].map(n => `<option value="${n}" ${this.pageSize===n?'selected':''}>${n} par page</option>`).join('')}
                        </select>
                        <button class="dt-btn dt-btn-export" title="Exporter CSV">&#128190; CSV</button>
                        <button class="dt-btn dt-btn-export-xl" title="Copier pour Excel">&#128203; Copier</button>
                    </div>
                </div>
                <div class="dt-table-wrap">
                    <table class="dt-table">
                        <thead>
                            <tr class="dt-header-row">
                                <th class="dt-th dt-th-check"><input type="checkbox" class="dt-select-all" /></th>
                                ${this.columns.map(col => `
                                    <th class="dt-th ${col.sortable !== false ? 'dt-sortable' : ''}" data-key="${col.key}" ${col.width ? `style="width:${col.width}"` : ''}>
                                        <div class="dt-th-inner">
                                            <span class="dt-th-label">${col.label}</span>
                                            ${col.sortable !== false ? `<span class="dt-sort-icon">${this.sortKey === col.key ? (this.sortDir === 'asc' ? '&#9650;' : '&#9660;') : '&#8693;'}</span>` : ''}
                                        </div>
                                    </th>
                                `).join('')}
                                ${this.actions ? '<th class="dt-th dt-th-actions">Actions</th>' : ''}
                            </tr>
                            <tr class="dt-filter-row">
                                <td></td>
                                ${this.columns.map(col => `
                                    <td class="dt-filter-cell">
                                        ${col.filterable !== false ? `<input type="text" class="dt-filter-input" data-key="${col.key}" placeholder="Filtrer..." value="${this.filters[col.key] || ''}" />` : ''}
                                    </td>
                                `).join('')}
                                ${this.actions ? '<td></td>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${paged.length === 0 ? `<tr><td colspan="${this.columns.length + (this.actions ? 2 : 1)}" class="dt-empty">Aucun résultat</td></tr>` : ''}
                            ${paged.map((row, idx) => {
                                const rowId = row.id || idx;
                                const selected = this.selectedRows.has(rowId);
                                return `<tr class="dt-row ${selected ? 'dt-row-selected' : ''}" data-id="${rowId}">
                                    <td class="dt-td dt-td-check"><input type="checkbox" class="dt-row-check" data-id="${rowId}" ${selected ? 'checked' : ''} /></td>
                                    ${this.columns.map(col => `
                                        <td class="dt-td" data-key="${col.key}">${col.render ? col.render(row[col.key], row) : esc(String(row[col.key] ?? ''))}</td>
                                    `).join('')}
                                    ${this.actions ? `<td class="dt-td dt-td-actions">${this.actions(row)}</td>` : ''}
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="dt-footer">
                    <div class="dt-footer-info">
                        ${this.selectedRows.size > 0 ? `<span class="dt-selected-count">${this.selectedRows.size} sélectionné(s)</span>` : ''}
                        <span>Page ${this.currentPage} / ${this.totalPages} (${filtered.length} enregistrements)</span>
                    </div>
                    <div class="dt-pagination">
                        <button class="dt-btn dt-btn-page" data-page="first" ${this.currentPage <= 1 ? 'disabled' : ''}>&#171;</button>
                        <button class="dt-btn dt-btn-page" data-page="prev" ${this.currentPage <= 1 ? 'disabled' : ''}>&#8249;</button>
                        ${this._paginationButtons()}
                        <button class="dt-btn dt-btn-page" data-page="next" ${this.currentPage >= this.totalPages ? 'disabled' : ''}>&#8250;</button>
                        <button class="dt-btn dt-btn-page" data-page="last" ${this.currentPage >= this.totalPages ? 'disabled' : ''}>&#187;</button>
                    </div>
                </div>
            </div>
        `;
        this._bindEvents();
    }

    _paginationButtons() {
        const total = this.totalPages;
        const current = this.currentPage;
        const pages = [];
        let start = Math.max(1, current - 2);
        let end = Math.min(total, current + 2);
        if (end - start < 4) {
            if (start === 1) end = Math.min(total, start + 4);
            else start = Math.max(1, end - 4);
        }
        for (let i = start; i <= end; i++) {
            pages.push(`<button class="dt-btn dt-btn-page ${i === current ? 'dt-btn-active' : ''}" data-page="${i}">${i}</button>`);
        }
        return pages.join('');
    }

    _bindEvents() {
        const c = this.container;
        // Search
        const searchInput = c.querySelector('.dt-search-input');
        if (searchInput) {
            let debounce;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounce);
                debounce = setTimeout(() => { this.searchText = e.target.value; this.currentPage = 1; this.render(); }, 250);
            });
        }
        // Column sort
        c.querySelectorAll('.dt-sortable').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.key;
                if (this.sortKey === key) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
                else { this.sortKey = key; this.sortDir = 'asc'; }
                this.render();
            });
        });
        // Per-column filter
        c.querySelectorAll('.dt-filter-input').forEach(inp => {
            let debounce;
            inp.addEventListener('input', (e) => {
                clearTimeout(debounce);
                debounce = setTimeout(() => {
                    this.filters[e.target.dataset.key] = e.target.value;
                    this.currentPage = 1;
                    this.render();
                }, 250);
            });
        });
        // Select all
        const selAll = c.querySelector('.dt-select-all');
        if (selAll) {
            selAll.addEventListener('change', (e) => {
                this.pagedData.forEach(row => {
                    const id = row.id || this.allData.indexOf(row);
                    if (e.target.checked) this.selectedRows.add(id);
                    else this.selectedRows.delete(id);
                });
                this.render();
            });
        }
        // Individual row select
        c.querySelectorAll('.dt-row-check').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                if (e.target.checked) this.selectedRows.add(isNaN(id) ? id : parseInt(id));
                else this.selectedRows.delete(isNaN(id) ? id : parseInt(id));
                this.render();
            });
        });
        // Page size
        const pageSel = c.querySelector('.dt-page-size');
        if (pageSel) {
            pageSel.addEventListener('change', (e) => { this.pageSize = parseInt(e.target.value); this.currentPage = 1; this.render(); });
        }
        // Pagination
        c.querySelectorAll('.dt-btn-page').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = btn.dataset.page;
                if (p === 'first') this.currentPage = 1;
                else if (p === 'prev') this.currentPage = Math.max(1, this.currentPage - 1);
                else if (p === 'next') this.currentPage = Math.min(this.totalPages, this.currentPage + 1);
                else if (p === 'last') this.currentPage = this.totalPages;
                else this.currentPage = parseInt(p);
                this.render();
            });
        });
        // CSV export
        c.querySelector('.dt-btn-export')?.addEventListener('click', () => this.exportCSV());
        // Copy for Excel
        c.querySelector('.dt-btn-export-xl')?.addEventListener('click', () => this.copyForExcel());
    }

    exportCSV() {
        const data = this.filteredData;
        const headers = this.columns.map(c => c.label);
        const rows = data.map(row => this.columns.map(col => {
            let val = String(row[col.key] ?? '');
            val = val.replace(/"/g, '""');
            return `"${val}"`;
        }));
        const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'export_' + new Date().toISOString().slice(0,10) + '.csv';
        a.click();
        URL.revokeObjectURL(a.href);
        if (typeof showToast === 'function') showToast('Export CSV téléchargé', 'success');
    }

    copyForExcel() {
        const data = this.filteredData;
        const headers = this.columns.map(c => c.label);
        const rows = data.map(row => this.columns.map(col => String(row[col.key] ?? '')));
        const tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
        navigator.clipboard.writeText(tsv).then(() => {
            if (typeof showToast === 'function') showToast('Copié ! Collez dans Excel avec Ctrl+V', 'success');
        });
    }

    getSelectedData() {
        return this.allData.filter(row => this.selectedRows.has(row.id));
    }
}
