import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Search, Plus, Trash2, X, Printer, Save, CreditCard, User,
    RefreshCw, ChevronDown, Package, ArrowLeft, RotateCcw,
    Barcode, Star, AlertCircle, CheckCircle2, Truck,
    ArrowLeftRight, Wallet, Tag, Building2, Layers,
} from 'lucide-react';
import api from '../../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuthContext } from '../../context/AuthContext';

// ── helpers ──────────────────────────────────────────────────────
const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtN = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const inp = { background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' };
const iCls = 'w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition';

const PAYMENT_MODES = [
    { key: 'cash',   label: 'Cash',   color: 'bg-green-50 border-green-300 text-green-700' },
    { key: 'upi',    label: 'UPI',    color: 'bg-purple-50 border-purple-300 text-purple-700' },
    { key: 'card',   label: 'Card',   color: 'bg-blue-50 border-blue-300 text-blue-700' },
    { key: 'bank',   label: 'Bank',   color: 'bg-indigo-50 border-indigo-300 text-indigo-700' },
    { key: 'wallet', label: 'Wallet', color: 'bg-orange-50 border-orange-300 text-orange-700' },
    { key: 'credit', label: 'Credit', color: 'bg-red-50 border-red-300 text-red-700' },
];

// ── Print invoice via jsPDF ───────────────────────────────────────
function printInvoice(invoice, items, payments, customer) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(255, 107, 0);
    doc.text('SIZE24', 14, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Smart Retail ERP', 14, 24);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('TAX INVOICE', W - 14, 18, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Invoice: ${invoice.invoice_number}`, W - 14, 24, { align: 'right' });
    doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-IN')}`, W - 14, 29, { align: 'right' });

    doc.setDrawColor(200, 200, 200);
    doc.line(14, 33, W - 14, 33);

    if (customer?.name || invoice.customer_name) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('BILL TO:', 14, 40);
        doc.setFont('helvetica', 'normal');
        doc.text(customer?.name || invoice.customer_name || 'Walk-in', 14, 46);
        if (customer?.mobile || invoice.customer_mobile)
            doc.text(`Mobile: ${customer?.mobile || invoice.customer_mobile}`, 14, 51);
        if (customer?.gst_number || invoice.customer_gst)
            doc.text(`GSTIN: ${customer?.gst_number || invoice.customer_gst}`, 14, 56);
    }

    const rows = items.map((item, idx) => [
        idx + 1,
        `${item.product_name}${item.size ? ' Sz:' + item.size : ''}${item.color ? ' ' + item.color : ''}${item.school_name ? '\n' + item.school_name : ''}`,
        item.hsn_code || '-',
        fmtN(item.unit_price),
        fmtN(item.qty),
        `${fmtN(item.discount)}`,
        `${fmtN(item.gst_rate)}%`,
        fmtN(item.total_price),
    ]);

    autoTable(doc, {
        startY: 62,
        head: [['#', 'Product', 'HSN', 'Rate', 'Qty', 'Disc', 'GST', 'Total']],
        body: rows,
        headStyles: { fillColor: [255, 107, 0], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 8 },
            2: { cellWidth: 18 },
            3: { cellWidth: 20, halign: 'right' },
            4: { cellWidth: 12, halign: 'center' },
            5: { cellWidth: 16, halign: 'right' },
            6: { cellWidth: 14, halign: 'center' },
            7: { cellWidth: 22, halign: 'right' },
        },
        margin: { left: 14, right: 14 },
    });

    const finalY = doc.lastAutoTable.finalY + 6;
    const summaryX = W - 70;
    const rows2 = [
        ['Subtotal', fmt(invoice.subtotal)],
        ['Discount', `- ${fmt(invoice.discount)}`],
        ['GST', fmt(invoice.gst_amount)],
    ];
    rows2.forEach(([label, val], i) => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(label, summaryX, finalY + i * 6);
        doc.text(val, W - 14, finalY + i * 6, { align: 'right' });
    });

    const gtY = finalY + rows2.length * 6 + 2;
    doc.setDrawColor(255, 107, 0);
    doc.line(summaryX, gtY, W - 14, gtY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 107, 0);
    doc.text('GRAND TOTAL', summaryX, gtY + 6);
    doc.text(fmt(invoice.total_amount), W - 14, gtY + 6, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('Payment:', summaryX, gtY + 13);
    const payStr = payments.map(p => `${p.mode?.toUpperCase()} ${fmt(p.amount)}`).join('  |  ');
    doc.text(payStr || 'Pending', summaryX + 20, gtY + 13);

    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text('Thank you for shopping with SIZE24!', W / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

    doc.save(`${invoice.invoice_number}.pdf`);
}

/* ══════════════════════════════════════════════════════════════════
   MAIN POS PAGE
══════════════════════════════════════════════════════════════════ */
export default function POSPage() {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    // ── Shop selection (stock/search is always scoped to this shop) ─
    const [shops, setShops]               = useState([]);
    const [selectedShopId, setSelectedShopId] = useState('');
    useEffect(() => {
        api.get('/shops').then(r => {
            setShops(r.data);
            if (user?.shopId) setSelectedShopId(String(user.shopId));
            else if (r.data.length === 1) setSelectedShopId(String(r.data[0].id));
        }).catch(() => {});
    }, [user?.shopId]);

    // ── Customer state ────────────────────────────────────────────
    const [customer, setCustomer]           = useState(null);
    const [custSearch, setCustSearch]       = useState('');
    const [custResults, setCustResults]     = useState([]);
    const [custLoading, setCustLoading]     = useState(false);
    const [showCustDropdown, setShowCustDropdown] = useState(false);
    const [showNewCust, setShowNewCust]     = useState(false);
    const [newCust, setNewCust]             = useState({ name: '', mobile: '', address: '', gst_number: '' });
    const [custSaving, setCustSaving]       = useState(false);
    const [redeemPoints, setRedeemPoints]   = useState(0);

    // ── Product search state ──────────────────────────────────────
    const [prodSearch, setProdSearch]       = useState('');
    const [prodResults, setProdResults]     = useState([]);
    const [prodLoading, setProdLoading]     = useState(false);
    const [showProdDropdown, setShowProdDropdown] = useState(false);
    const [selectedProdIdx, setSelectedProdIdx]   = useState(0);
    const [barcodeMode, setBarcodeMode]     = useState(false);

    // ── Cart state ────────────────────────────────────────────────
    const [lines, setLines]                 = useState([]);
    const [invoiceDate, setInvoiceDate]     = useState(today());
    const [docDiscount, setDocDiscount]     = useState('0');
    const [notes, setNotes]                 = useState('');

    // ── Payment modal ─────────────────────────────────────────────
    const [showPayModal, setShowPayModal]   = useState(false);
    const [payAmounts, setPayAmounts]       = useState({ cash: '', upi: '', card: '', bank: '', wallet: '' });
    const [cashGiven, setCashGiven]         = useState('');

    // ── Phase 2: Exchange mode ────────────────────────────────────
    const [exchangeMode, setExchangeMode]       = useState(false);
    const [exchangeLines, setExchangeLines]     = useState([]);
    const [exProdSearch, setExProdSearch]       = useState('');
    const [exProdResults, setExProdResults]     = useState([]);
    const [exProdLoading, setExProdLoading]     = useState(false);
    const [showExDropdown, setShowExDropdown]   = useState(false);

    // ── Phase 2: Advances ─────────────────────────────────────────
    const [pendingAdvances, setPendingAdvances] = useState([]);
    const [advanceAdjust, setAdvanceAdjust]     = useState([]);  // [{ advance_id, amount }]
    const [showAdvanceModal, setShowAdvanceModal] = useState(false);

    // ── Phase 2: Warehouse ────────────────────────────────────────
    const [warehouses, setWarehouses]           = useState([]);
    const [defaultWarehouse, setDefaultWarehouse] = useState('');

    // ── Phase 2: Offers ───────────────────────────────────────────
    const [appliedOffers, setAppliedOffers]     = useState([]);
    const [offerSavings, setOfferSavings]       = useState(0);

    // ── Return modal ──────────────────────────────────────────────
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returnRef, setReturnRef]         = useState('');
    const [returnInvoice, setReturnInvoice] = useState(null);
    const [returnItems, setReturnItems]     = useState([]);
    const [returnLoading, setReturnLoading] = useState(false);

    // ── UI state ──────────────────────────────────────────────────
    const [saving, setSaving]               = useState(false);
    const [savedInvoice, setSavedInvoice]   = useState(null);
    const [toast, setToast]                 = useState(null);

    // ── Refs ──────────────────────────────────────────────────────
    const custRef    = useRef(null);
    const prodRef    = useRef(null);
    const barcodeRef = useRef(null);

    // ── Toast helper ──────────────────────────────────────────────
    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // ── Keyboard shortcuts ────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                if (e.key === 'Escape') { e.target.blur(); setShowProdDropdown(false); setShowCustDropdown(false); }
                return;
            }
            if (e.key === 'F2')  { e.preventDefault(); custRef.current?.focus(); }
            if (e.key === 'F3')  { e.preventDefault(); prodRef.current?.focus(); }
            if (e.key === 'F4')  { e.preventDefault(); addEmptyLine(); }
            if (e.key === 'F6')  { e.preventDefault(); if (lines.length) setShowPayModal(true); }
            if (e.key === 'F8')  { e.preventDefault(); if (savedInvoice) printInvoice(savedInvoice, savedInvoice.items, savedInvoice.payments, customer); }
            if (e.key === 'F9')  { e.preventDefault(); if (lines.length) handleSave(); }
            if (e.key === 'Escape') { setShowPayModal(false); setShowReturnModal(false); setShowProdDropdown(false); setShowCustDropdown(false); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [lines, savedInvoice, customer]);

    // ── Load warehouses on mount ──────────────────────────────────
    useEffect(() => {
        api.get('/pos2/warehouses').then(r => {
            setWarehouses(r.data);
            if (r.data.length === 1) setDefaultWarehouse(String(r.data[0].id));
        }).catch(() => {});
    }, []);

    // ── Load advances when customer selected ──────────────────────
    useEffect(() => {
        if (!customer?.id) { setPendingAdvances([]); setAdvanceAdjust([]); return; }
        api.get(`/pos2/advances/${customer.id}`).then(r => setPendingAdvances(r.data)).catch(() => {});
    }, [customer?.id]);

    // ── Check offers when cart changes (debounced) ────────────────
    useEffect(() => {
        if (!lines.length) { setAppliedOffers([]); setOfferSavings(0); return; }
        const t = setTimeout(async () => {
            try {
                const r = await api.post('/pos2/check-offers', {
                    items: lines.map(l => ({ product_id: l.product_id, variant_id: l.variant_id, qty: l.qty, unit_price: l.unit_price })),
                    customer_id: customer?.id || null,
                    school_id: customer?.school_id || null,
                });
                setAppliedOffers(r.data.applied || []);
                setOfferSavings(r.data.total_savings || 0);
            } catch {}
        }, 600);
        return () => clearTimeout(t);
    }, [lines, customer?.id]);

    // ── Exchange product search (debounced) ───────────────────────
    useEffect(() => {
        if (!exProdSearch.trim()) { setExProdResults([]); return; }
        const t = setTimeout(async () => {
            setExProdLoading(true);
            try {
                const r = await api.get(`/pos/search-products?q=${encodeURIComponent(exProdSearch)}`);
                setExProdResults(r.data);
                setShowExDropdown(true);
            } catch {} finally { setExProdLoading(false); }
        }, 200);
        return () => clearTimeout(t);
    }, [exProdSearch]);

    // ── Customer search (debounced) ───────────────────────────────
    useEffect(() => {
        if (!custSearch.trim()) { setCustResults([]); return; }
        const t = setTimeout(async () => {
            setCustLoading(true);
            try {
                const r = await api.get(`/pos/search-customers?q=${encodeURIComponent(custSearch)}`);
                setCustResults(r.data);
                setShowCustDropdown(true);
            } catch {} finally { setCustLoading(false); }
        }, 200);
        return () => clearTimeout(t);
    }, [custSearch]);

    // ── Product search (debounced) ────────────────────────────────
    useEffect(() => {
        if (!prodSearch.trim() || barcodeMode) { setProdResults([]); return; }
        const t = setTimeout(async () => {
            setProdLoading(true);
            try {
                const shopQS = selectedShopId ? `&shop_id=${selectedShopId}` : '';
                const r = await api.get(`/pos/search-products?q=${encodeURIComponent(prodSearch)}${shopQS}`);
                setProdResults(r.data);
                setSelectedProdIdx(0);
                setShowProdDropdown(true);
            } catch {} finally { setProdLoading(false); }
        }, 200);
        return () => clearTimeout(t);
    }, [prodSearch, barcodeMode, selectedShopId]);

    // ── Calculations ──────────────────────────────────────────────
    const subtotal  = lines.reduce((s, l) => s + parseFloat(l.qty || 0) * parseFloat(l.unit_price || 0), 0);
    const discLines = lines.reduce((s, l) => s + parseFloat(l.discount || 0), 0);
    const gstTotal  = lines.reduce((s, l) => {
        const base = parseFloat(l.qty || 0) * parseFloat(l.unit_price || 0) - parseFloat(l.discount || 0);
        return s + base * (parseFloat(l.gst_rate || 0) / 100);
    }, 0);
    const docDisc      = parseFloat(docDiscount || 0);
    const pointsVal    = parseFloat(redeemPoints || 0);
    // Phase 2 derived values
    const exchangeTotal   = exchangeLines.reduce((s, l) => s + parseFloat(l.qty || 0) * parseFloat(l.unit_price || 0), 0);
    const totalAdvAdj     = advanceAdjust.reduce((s, a) => s + parseFloat(a.amount || 0), 0);
    const grandTotal      = Math.max(0, subtotal - discLines + gstTotal - docDisc - pointsVal - exchangeTotal - totalAdvAdj);

    const totalPaid = Object.values(payAmounts).reduce((s, v) => s + parseFloat(v || 0), 0);
    const cashChange = parseFloat(cashGiven || 0) - (grandTotal - (totalPaid - parseFloat(payAmounts.cash || 0)));

    const lineTotal = (l) => {
        const base = parseFloat(l.qty || 0) * parseFloat(l.unit_price || 0) - parseFloat(l.discount || 0);
        return base + base * (parseFloat(l.gst_rate || 0) / 100);
    };

    // ── Cart helpers ──────────────────────────────────────────────
    const makeCartLine = (prod) => ({
        variant_id:   prod.variant_id,
        product_id:   prod.product_id,
        product_name: `${prod.product_name}${prod.school_name ? ' – ' + prod.school_name : ''}`,
        size:         prod.size || '',
        color:        prod.color || '',
        sku:          prod.sku || '',
        stock:        parseFloat(prod.stock || 0),
        qty:          '1',
        unit_price:   String(prod.sale_price || 0),
        discount:     String(prod.disc_on_sale || 0),
        gst_rate:     String(prod.gst_rate || 0),
        warehouse_id: defaultWarehouse || '',
        batch_id:     '',
        lot_number:   '',
    });

    const shopName = shops.find(s => String(s.id) === String(selectedShopId))?.shop_name || 'this shop';

    const addProductToCart = useCallback((prod) => {
        const available = parseFloat(prod.stock || 0);
        if (selectedShopId && available <= 0) {
            showToast(`Only 0 units available at ${shopName}.`, 'error');
            return;
        }
        setLines(prev => {
            const existing = prev.findIndex(l => l.variant_id === prod.variant_id);
            if (existing >= 0) {
                const nextQty = parseFloat(prev[existing].qty || 1) + 1;
                if (selectedShopId && nextQty > available) {
                    showToast(`Only ${available} units available at ${shopName}.`, 'error');
                    return prev;
                }
                return prev.map((l, i) => i === existing ? { ...l, qty: String(nextQty) } : l);
            }
            return [...prev, makeCartLine(prod)];
        });
        setProdSearch('');
        setProdResults([]);
        setShowProdDropdown(false);
        showToast(`${prod.product_name} added`, 'success');
    }, [showToast, selectedShopId, shopName]);

    const addEmptyLine = () => setLines(l => [...l, {
        variant_id: '', product_id: '', product_name: '', size: '', color: '', sku: '',
        stock: 0, qty: '1', unit_price: '0', discount: '0', gst_rate: '0',
        warehouse_id: defaultWarehouse || '', batch_id: '', lot_number: '',
    }]);

    // Exchange cart helpers
    const addToExchange = (prod) => {
        setExchangeLines(prev => {
            const ex = prev.findIndex(l => l.variant_id === prod.variant_id);
            if (ex >= 0) return prev.map((l, i) => i === ex ? { ...l, qty: String(parseFloat(l.qty||1)+1) } : l);
            return [...prev, makeCartLine(prod)];
        });
        setExProdSearch(''); setExProdResults([]); setShowExDropdown(false);
    };
    const removeExLine = (i) => setExchangeLines(l => l.filter((_,idx) => idx !== i));
    const updExLine = (i,k,v) => setExchangeLines(l => l.map((line,idx) => idx===i ? {...line,[k]:v} : line));

    const removeLine = (i) => setLines(l => l.filter((_, idx) => idx !== i));
    const updLine    = (i, k, v) => {
        if (k === 'qty' && selectedShopId) {
            const line = lines[i];
            const requested = parseFloat(v || 0);
            const available = parseFloat(line?.stock || 0);
            if (line?.variant_id && requested > available) {
                showToast(`Only ${available} units available at ${shopName}.`, 'error');
                v = String(available);
            }
        }
        setLines(l => l.map((line, idx) => idx === i ? { ...line, [k]: v } : line));
    };

    // ── Barcode scan ──────────────────────────────────────────────
    const handleBarcodeEnter = async () => {
        const code = prodSearch.trim();
        if (!code) return;
        try {
            const shopQS = selectedShopId ? `?shop_id=${selectedShopId}` : '';
            const r = await api.get(`/pos/barcode/${encodeURIComponent(code)}${shopQS}`);
            addProductToCart(r.data);
        } catch { showToast('Product not found for barcode: ' + code, 'error'); }
        setProdSearch('');
    };

    // ── Product search key navigation ─────────────────────────────
    const handleProdKeyDown = (e) => {
        if (!showProdDropdown || !prodResults.length) {
            if (e.key === 'Enter' && barcodeMode) handleBarcodeEnter();
            return;
        }
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedProdIdx(i => Math.min(i + 1, prodResults.length - 1)); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedProdIdx(i => Math.max(i - 1, 0)); }
        if (e.key === 'Enter')     { e.preventDefault(); addProductToCart(prodResults[selectedProdIdx]); }
        if (e.key === 'Escape')    { setShowProdDropdown(false); }
    };

    // ── Quick-create customer ─────────────────────────────────────
    const handleCreateCustomer = async () => {
        if (!newCust.name.trim()) return;
        setCustSaving(true);
        try {
            const r = await api.post('/pos/customers', newCust);
            setCustomer(r.data);
            setShowNewCust(false);
            setNewCust({ name: '', mobile: '', address: '', gst_number: '' });
            setCustSearch('');
            setShowCustDropdown(false);
            showToast(`Customer "${r.data.name}" created`);
        } catch (e) { showToast(e.response?.data?.error || 'Failed to create customer', 'error'); }
        finally { setCustSaving(false); }
    };

    // ── Save Invoice (Phase 2: routes to exchange or standard) ───
    const handleSave = async (paymentsArr = []) => {
        if (!lines.length || lines.some(l => !l.variant_id)) {
            showToast('Add at least one valid product', 'error'); return;
        }
        if (shops.length && !selectedShopId) {
            showToast('Select a shop before billing', 'error'); return;
        }
        setSaving(true);
        try {
            const endpoint = (exchangeMode && exchangeLines.length) ? '/pos2/exchange-invoice' : '/pos/invoice';
            const payload = {
                customer_id:   customer?.id || null,
                shop_id:       selectedShopId || null,
                invoice_date:  invoiceDate,
                discount:      docDisc,
                notes,
                payments:      paymentsArr,
                redeem_points: redeemPoints,
                advance_ids:   advanceAdjust.filter(a => parseFloat(a.amount) > 0),
            };
            if (exchangeMode && exchangeLines.length) {
                payload.new_items    = lines.map(l => ({ variant_id: l.variant_id, qty: l.qty, unit_price: l.unit_price, discount: l.discount, gst_rate: l.gst_rate, warehouse_id: l.warehouse_id||null, batch_id: l.batch_id||null, lot_number: l.lot_number||null }));
                payload.return_items = exchangeLines.map(l => ({ variant_id: l.variant_id, qty: l.qty, unit_price: l.unit_price }));
            } else {
                payload.items = lines.map(l => ({ variant_id: l.variant_id, qty: l.qty, unit_price: l.unit_price, discount: l.discount, gst_rate: l.gst_rate, warehouse_id: l.warehouse_id||null, batch_id: l.batch_id||null, lot_number: l.lot_number||null }));
            }
            const r = await api.post(endpoint, payload);
            setSavedInvoice(r.data);
            setShowPayModal(false);
            showToast(`Invoice ${r.data.invoice_number} saved!`);
        } catch (e) { showToast(e.response?.data?.error || 'Save failed', 'error'); }
        finally { setSaving(false); }
    };

    // ── Confirm payment ───────────────────────────────────────────
    const handleConfirmPayment = () => {
        const paymentsArr = Object.entries(payAmounts)
            .filter(([, v]) => parseFloat(v) > 0)
            .map(([mode, amount]) => ({ mode, amount: parseFloat(amount) }));
        if (!paymentsArr.length) paymentsArr.push({ mode: 'cash', amount: 0 });
        handleSave(paymentsArr);
    };

    // ── New invoice reset ─────────────────────────────────────────
    const handleNewInvoice = () => {
        setLines([]); setCustomer(null); setCustSearch('');
        setDocDiscount('0'); setNotes(''); setRedeemPoints(0);
        setSavedInvoice(null); setPayAmounts({ cash: '', upi: '', card: '', bank: '', wallet: '' });
        setCashGiven('');
        // Phase 2 reset
        setExchangeMode(false); setExchangeLines([]); setExProdSearch('');
        setAdvanceAdjust([]); setPendingAdvances([]);
        setAppliedOffers([]); setOfferSavings(0);
        prodRef.current?.focus();
    };

    // ── Return lookup ─────────────────────────────────────────────
    const handleReturnLookup = async () => {
        if (!returnRef.trim()) return;
        setReturnLoading(true);
        try {
            const r = await api.get(`/pos/invoice/${encodeURIComponent(returnRef.trim())}`);
            setReturnInvoice(r.data);
            setReturnItems(r.data.items.map(i => ({ ...i, return_qty: '0', selected: false })));
        } catch { showToast('Invoice not found', 'error'); }
        finally { setReturnLoading(false); }
    };

    const handleProcessReturn = async () => {
        const toReturn = returnItems.filter(i => i.selected && parseFloat(i.return_qty) > 0);
        if (!toReturn.length) { showToast('Select items to return', 'error'); return; }
        try {
            const r = await api.post('/pos/return', {
                invoice_id:  returnInvoice.id,
                customer_id: returnInvoice.customer_id,
                shop_id:     returnInvoice.shop_id || selectedShopId || null,
                return_date: today(),
                reason:      'Customer return',
                items:       toReturn.map(i => ({
                    variant_id:  i.variant_id,
                    qty:         i.return_qty,
                    unit_price:  i.unit_price,
                })),
            });
            showToast(`Return ${r.data.return_number} processed. ₹${r.data.total_amount} refund.`);
            setShowReturnModal(false); setReturnRef(''); setReturnInvoice(null);
        } catch (e) { showToast(e.response?.data?.error || 'Return failed', 'error'); }
    };

    /* ── RENDER ─────────────────────────────────────────────────── */
    return (
        <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--bg-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}>

            {/* ── TOP BAR ─────────────────────────────────────── */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b shadow-sm"
                style={{ background: 'var(--bg-sidebar)', borderColor: 'rgba(255,255,255,0.1)', minHeight: 48 }}>
                <Link to="/inventory/sales" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-xs">
                    <ArrowLeft className="h-4 w-4" /> Sales
                </Link>
                <div className="w-px h-4 bg-white/20" />
                <span className="text-white font-bold text-sm" style={{ color: '#FF6B00' }}>POS Terminal</span>
                {shops.length > 1 && (
                    <select value={selectedShopId} onChange={e => setSelectedShopId(e.target.value)}
                        className="text-xs font-bold px-2 py-1 rounded-lg border outline-none"
                        style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', borderColor: 'rgba(255,255,255,0.15)' }}>
                        <option value="" style={{ color: '#000' }}>-- Select Shop --</option>
                        {shops.map(s => <option key={s.id} value={s.id} style={{ color: '#000' }}>{s.shop_name}</option>)}
                    </select>
                )}
                {savedInvoice && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(255,107,0,0.2)', color: '#FF6B00' }}>
                        {savedInvoice.invoice_number}
                    </span>
                )}
                <div className="flex-1" />
                {/* Keyboard shortcut hints */}
                <div className="hidden lg:flex items-center gap-3">
                    {[['F2','Customer'],['F3','Product'],['F4','Add Row'],['F6','Payment'],['F9','Save']].map(([k,v]) => (
                        <span key={k} className="text-[10px] text-gray-400">
                            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background:'rgba(255,255,255,0.1)',color:'#fff' }}>{k}</kbd>
                            <span className="ml-1">{v}</span>
                        </span>
                    ))}
                </div>
                <div className="flex-1 hidden lg:block" />
                <button onClick={() => { setExchangeMode(m => !m); setExchangeLines([]); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${exchangeMode ? 'text-white border-orange-500' : 'text-gray-300 hover:bg-white/10 border-white/10'}`}
                    style={exchangeMode ? { background: 'rgba(255,107,0,0.3)' } : {}}>
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Exchange
                </button>
                <button onClick={() => setShowReturnModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:bg-white/10 border border-white/10">
                    <RotateCcw className="h-3.5 w-3.5" /> Return
                </button>
                {savedInvoice && (
                    <button onClick={() => printInvoice(savedInvoice, savedInvoice.items || [], savedInvoice.payments || [], customer)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white border border-orange-500"
                        style={{ background: 'rgba(255,107,0,0.2)' }}>
                        <Printer className="h-3.5 w-3.5" /> Print (F8)
                    </button>
                )}
                {savedInvoice && (
                    <button onClick={handleNewInvoice}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                        style={{ background: '#FF6B00' }}>
                        <Plus className="h-3.5 w-3.5" /> New Bill
                    </button>
                )}
            </div>

            {/* ── MAIN 3-COLUMN ────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">

                {/* ── LEFT: CUSTOMER PANEL ─────────────────────── */}
                <div className="w-64 flex-shrink-0 flex flex-col border-r"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5"
                            style={{ color: 'var(--text-secondary)' }}>
                            <User className="h-3 w-3" /> Customer
                            <span className="ml-auto text-[9px] px-1 py-0.5 rounded" style={{ background:'rgba(255,107,0,0.1)',color:'#FF6B00' }}>F2</span>
                        </p>
                        <div className="relative">
                            <input
                                ref={custRef}
                                value={custSearch}
                                onChange={e => { setCustSearch(e.target.value); setShowCustDropdown(true); }}
                                onFocus={() => custSearch && setShowCustDropdown(true)}
                                placeholder="Search by mobile or name…"
                                className="w-full pl-8 pr-3 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-orange-400"
                                style={inp}
                            />
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            {custLoading && <RefreshCw className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 animate-spin" />}
                        </div>

                        {showCustDropdown && custResults.length > 0 && (
                            <div className="mt-1 border rounded-lg overflow-hidden shadow-lg z-20 relative"
                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                                {custResults.map(c => (
                                    <button key={c.id} onClick={() => { setCustomer(c); setCustSearch(''); setShowCustDropdown(false); }}
                                        className="w-full text-left px-3 py-2 hover:bg-orange-50/30 border-b last:border-b-0 transition-colors"
                                        style={{ borderColor: 'var(--border-color)' }}>
                                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                                        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                                            {c.mobile} {c.school_name ? `• ${c.school_name}` : ''}
                                        </p>
                                    </button>
                                ))}
                                <button onClick={() => { setShowCustDropdown(false); setShowNewCust(true); }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-1.5 hover:bg-orange-50/30"
                                    style={{ color: '#FF6B00' }}>
                                    <Plus className="h-3.5 w-3.5" /> Create new customer
                                </button>
                            </div>
                        )}

                        {showCustDropdown && custSearch && !custResults.length && !custLoading && (
                            <div className="mt-1 border rounded-lg overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                                <button onClick={() => { setShowCustDropdown(false); setShowNewCust(true); setNewCust(f => ({ ...f, name: custSearch, mobile: /^\d{10}$/.test(custSearch) ? custSearch : '', })); }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-1.5 hover:bg-orange-50/30"
                                    style={{ color: '#FF6B00' }}>
                                    <Plus className="h-3.5 w-3.5" /> Create "{custSearch}"
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Customer info card */}
                    {customer ? (
                        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                            <div className="rounded-xl p-3 border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{customer.name}</p>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{customer.mobile}</p>
                                        {customer.school_name && <p className="text-[10px] mt-0.5 px-1.5 py-0.5 rounded inline-block" style={{ background:'rgba(255,107,0,0.1)',color:'#FF6B00' }}>{customer.school_name}</p>}
                                    </div>
                                    <button onClick={() => { setCustomer(null); setCustSearch(''); }} className="p-1 rounded hover:bg-red-50 text-red-400">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>

                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <div className="rounded-lg p-2" style={{ background: 'var(--bg-surface)' }}>
                                        <p className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Outstanding</p>
                                        <p className="text-sm font-bold" style={{ color: parseFloat(customer.current_balance) > 0 ? '#ef4444' : '#10b981' }}>
                                            {fmt(customer.current_balance)}
                                        </p>
                                    </div>
                                    <div className="rounded-lg p-2 cursor-pointer hover:ring-1 hover:ring-orange-400"
                                        style={{ background: 'var(--bg-surface)' }}
                                        onClick={() => setRedeemPoints(Math.min(customer.loyalty_points, Math.floor(grandTotal)))}>
                                        <p className="text-[9px] uppercase tracking-wide flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                                            <Star className="h-2.5 w-2.5 text-yellow-500" /> Points
                                        </p>
                                        <p className="text-sm font-bold text-yellow-600">{customer.loyalty_points || 0}</p>
                                    </div>
                                </div>

                                {customer.loyalty_points > 0 && (
                                    <div className="mt-2">
                                        <label className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Redeem Points (1pt = ₹1)</label>
                                        <input type="number" min={0} max={customer.loyalty_points}
                                            value={redeemPoints}
                                            onChange={e => setRedeemPoints(Math.min(parseInt(e.target.value) || 0, customer.loyalty_points))}
                                            className="w-full mt-0.5 px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-orange-400"
                                            style={inp} />
                                    </div>
                                )}
                            </div>

                            {/* Pending advances */}
                            {pendingAdvances.length > 0 && (
                                <div className="rounded-lg p-2 mt-2 border" style={{ background:'var(--bg-surface)', borderColor:'rgba(99,102,241,0.3)' }}>
                                    <p className="text-[10px] font-bold flex items-center gap-1" style={{ color:'#6366f1' }}>
                                        <Wallet className="h-3 w-3" /> Pending Advances: {fmt(pendingAdvances.reduce((s,a)=>s+parseFloat(a.balance),0))}
                                    </p>
                                    <button onClick={() => setShowAdvanceModal(true)}
                                        className="mt-1 text-[10px] px-2 py-0.5 rounded font-semibold text-white" style={{ background:'#6366f1' }}>
                                        Apply Advance
                                    </button>
                                    {totalAdvAdj > 0 && (
                                        <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Applied: {fmt(totalAdvAdj)}</p>
                                    )}
                                </div>
                            )}

                            {/* Credit limit warning */}
                            {customer.credit_limit > 0 && (
                                <div className={`rounded-lg p-2 mt-2 border text-[10px] ${parseFloat(customer.current_balance) > parseFloat(customer.credit_limit) ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
                                    <p className={`font-bold ${parseFloat(customer.current_balance) > parseFloat(customer.credit_limit) ? 'text-red-600' : 'text-green-600'}`}>
                                        Credit Limit: {fmt(customer.credit_limit)}
                                        {parseFloat(customer.current_balance) > parseFloat(customer.credit_limit) && ' ⚠ EXCEEDED'}
                                    </p>
                                </div>
                            )}

                            {/* Recent invoices */}
                            {customer.recent_invoices?.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-secondary)' }}>Recent Purchases</p>
                                    <div className="space-y-1">
                                        {customer.recent_invoices.slice(0, 5).map(inv => (
                                            <div key={inv.id} className="flex justify-between items-center px-2 py-1.5 rounded-lg"
                                                style={{ background: 'var(--bg-primary)' }}>
                                                <div>
                                                    <p className="text-[10px] font-mono font-semibold" style={{ color: '#FF6B00' }}>{inv.invoice_number}</p>
                                                    <p className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>
                                                        {new Date(inv.invoice_date).toLocaleDateString('en-IN')}
                                                    </p>
                                                </div>
                                                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(inv.total_amount)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
                            <User className="h-10 w-10 mb-2 opacity-20" style={{ color: 'var(--text-secondary)' }} />
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No customer selected</p>
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>Walk-in sale</p>
                        </div>
                    )}
                </div>

                {/* ── CENTER: PRODUCT SEARCH + CART ────────────── */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                    {/* Product search bar */}
                    <div className="flex-shrink-0 px-4 py-2 border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div className="flex gap-2 items-center">
                            <div className="relative flex-1">
                                <input
                                    ref={barcodeMode ? barcodeRef : prodRef}
                                    value={prodSearch}
                                    onChange={e => setProdSearch(e.target.value)}
                                    onKeyDown={handleProdKeyDown}
                                    onFocus={() => prodResults.length && setShowProdDropdown(true)}
                                    placeholder={barcodeMode ? 'Scan barcode / SKU + Enter…' : 'Search product by name, SKU, category, color, size… (F3)'}
                                    className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400"
                                    style={inp}
                                    autoFocus
                                />
                                {barcodeMode
                                    ? <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400" />
                                    : <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />}
                                {prodLoading && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />}
                            </div>
                            <button onClick={() => { setBarcodeMode(b => !b); setProdSearch(''); setProdResults([]); setShowProdDropdown(false); }}
                                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${barcodeMode ? 'text-white border-orange-500' : 'border-gray-300'}`}
                                style={barcodeMode ? { background: '#FF6B00' } : { background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                                <Barcode className="h-4 w-4" /> Barcode
                            </button>
                            <button onClick={addEmptyLine}
                                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold"
                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                                <Plus className="h-4 w-4" /> Row (F4)
                            </button>
                        </div>

                        {/* Product search dropdown */}
                        {showProdDropdown && prodResults.length > 0 && (
                            <div className="absolute left-80 right-80 mt-1 border rounded-xl shadow-2xl z-30 overflow-hidden max-h-72 overflow-y-auto"
                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', top: 96 }}>
                                {prodResults.map((prod, idx) => (
                                    <button key={prod.variant_id} onClick={() => addProductToCart(prod)}
                                        className={`w-full text-left px-4 py-2.5 border-b last:border-b-0 flex items-center gap-3 transition-colors ${idx === selectedProdIdx ? 'bg-orange-50/40' : 'hover:bg-orange-50/20'}`}
                                        style={{ borderColor: 'var(--border-color)' }}>
                                        <Package className="h-5 w-5 flex-shrink-0 text-gray-300" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                                {prod.product_name}
                                                {prod.school_name && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background:'rgba(255,107,0,0.1)',color:'#FF6B00' }}>{prod.school_name}</span>}
                                            </p>
                                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                {prod.sku && <span className="mr-2">SKU: {prod.sku}</span>}
                                                {prod.size && <span className="mr-2">Sz: {prod.size}</span>}
                                                {prod.color && <span className="mr-2">{prod.color}</span>}
                                                {prod.category_name && <span>{prod.category_name}</span>}
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-sm font-bold" style={{ color: '#FF6B00' }}>{fmt(prod.sale_price)}</p>
                                            <p className={`text-xs font-semibold ${parseFloat(prod.stock) <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                                {parseFloat(prod.stock) <= 0 ? 'Out of stock' : `Stock: ${prod.stock}`}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Exchange Return Panel */}
                    {exchangeMode && (
                        <div className="flex-shrink-0 border-b" style={{ borderColor:'var(--border-color)', background:'rgba(255,107,0,0.03)' }}>
                            <div className="px-4 py-2 flex items-center gap-2 border-b" style={{ borderColor:'var(--border-color)' }}>
                                <ArrowLeftRight className="h-4 w-4" style={{ color:'#FF6B00' }} />
                                <span className="text-xs font-bold" style={{ color:'#FF6B00' }}>Return Items (Exchange)</span>
                                <span className="text-xs ml-auto font-bold" style={{ color:'#FF6B00' }}>Credit: {fmt(exchangeTotal)}</span>
                            </div>
                            <div className="px-4 py-2 flex gap-2">
                                <div className="relative flex-1">
                                    <input value={exProdSearch} onChange={e => setExProdSearch(e.target.value)}
                                        placeholder="Search item being returned…"
                                        className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-orange-400"
                                        style={inp} />
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                    {exProdLoading && <RefreshCw className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-gray-400" />}
                                    {showExDropdown && exProdResults.length > 0 && (
                                        <div className="absolute left-0 right-0 mt-1 border rounded-xl shadow-2xl z-30 overflow-hidden max-h-48 overflow-y-auto" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                            {exProdResults.map(p => (
                                                <button key={p.variant_id} onClick={() => addToExchange(p)}
                                                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-orange-50/30 border-b" style={{ borderColor:'var(--border-color)' }}>
                                                    <Package className="h-4 w-4 text-gray-300 flex-shrink-0" />
                                                    <span className="text-xs font-medium" style={{ color:'var(--text-primary)' }}>{p.product_name} {p.size && `Sz:${p.size}`}</span>
                                                    <span className="ml-auto text-xs font-bold" style={{ color:'#FF6B00' }}>{fmt(p.sale_price)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {exchangeLines.length > 0 && (
                                <table className="w-full text-xs border-t" style={{ borderColor:'var(--border-color)' }}>
                                    <tbody>
                                        {exchangeLines.map((line, i) => (
                                            <tr key={i} className="border-b" style={{ borderColor:'var(--border-color)' }}>
                                                <td className="px-4 py-1.5 font-medium" style={{ color:'var(--text-primary)' }}>{line.product_name}</td>
                                                <td className="px-2 py-1.5 w-16">
                                                    <input type="number" min="0.001" value={line.qty} onChange={e => updExLine(i,'qty',e.target.value)}
                                                        className="w-full px-1.5 py-1 border rounded text-center outline-none focus:ring-1 focus:ring-orange-400" style={inp} />
                                                </td>
                                                <td className="px-2 py-1.5 w-20">
                                                    <input type="number" min="0" value={line.unit_price} onChange={e => updExLine(i,'unit_price',e.target.value)}
                                                        className="w-full px-1.5 py-1 border rounded text-right outline-none focus:ring-1 focus:ring-orange-400" style={inp} />
                                                </td>
                                                <td className="px-2 py-1.5 text-right font-bold w-20" style={{ color:'#FF6B00' }}>
                                                    {fmt(parseFloat(line.qty||0)*parseFloat(line.unit_price||0))}
                                                </td>
                                                <td className="px-2 py-1.5 w-8">
                                                    <button onClick={() => removeExLine(i)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 className="h-3 w-3" /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* Cart Table */}
                    <div className="flex-1 overflow-y-auto">
                        {lines.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-secondary)' }}>
                                <Package className="h-16 w-16 opacity-10" />
                                <p className="text-sm">Search a product or scan a barcode to start billing</p>
                                <p className="text-xs opacity-60">Press F3 to search · Press F4 to add empty row</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}>
                                        {['#','Product','Size','Color','Qty','Price','Disc ₹','GST %', ...(warehouses.length>1?['Warehouse']:[]), 'Total',''].map(h => (
                                            <th key={h} className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap"
                                                style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map((line, i) => (
                                        <tr key={i} className="border-b hover:bg-orange-50/10 transition-colors"
                                            style={{ borderColor: 'var(--border-color)' }}>
                                            <td className="px-2 py-1.5 text-xs text-center w-8" style={{ color: 'var(--text-secondary)' }}>{i + 1}</td>
                                            <td className="px-2 py-1.5 max-w-xs">
                                                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{line.product_name || '—'}</p>
                                                {line.sku && <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>SKU: {line.sku}</p>}
                                                {parseFloat(line.stock) <= 0 && (
                                                    <span className="text-[9px] text-red-500 font-semibold">Low stock!</span>
                                                )}
                                            </td>
                                            <td className="px-2 py-1.5 w-16">
                                                <input value={line.size} onChange={e => updLine(i,'size',e.target.value)}
                                                    className="w-full px-1.5 py-1 border rounded text-xs outline-none text-center focus:ring-1 focus:ring-orange-400"
                                                    style={inp} placeholder="–" />
                                            </td>
                                            <td className="px-2 py-1.5 w-20">
                                                <input value={line.color} onChange={e => updLine(i,'color',e.target.value)}
                                                    className="w-full px-1.5 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-orange-400"
                                                    style={inp} placeholder="–" />
                                            </td>
                                            <td className="px-2 py-1.5 w-16">
                                                <input type="number" min="0.001" step="0.001" value={line.qty}
                                                    onChange={e => updLine(i,'qty',e.target.value)}
                                                    className="w-full px-1.5 py-1 border rounded text-xs outline-none text-center focus:ring-1 focus:ring-orange-400"
                                                    style={inp} />
                                            </td>
                                            <td className="px-2 py-1.5 w-24">
                                                <input type="number" min="0" value={line.unit_price}
                                                    onChange={e => updLine(i,'unit_price',e.target.value)}
                                                    className="w-full px-1.5 py-1 border rounded text-xs outline-none text-right focus:ring-1 focus:ring-orange-400"
                                                    style={inp} />
                                            </td>
                                            <td className="px-2 py-1.5 w-20">
                                                <input type="number" min="0" value={line.discount}
                                                    onChange={e => updLine(i,'discount',e.target.value)}
                                                    className="w-full px-1.5 py-1 border rounded text-xs outline-none text-right focus:ring-1 focus:ring-orange-400"
                                                    style={inp} />
                                            </td>
                                            <td className="px-2 py-1.5 w-20">
                                                <select value={line.gst_rate} onChange={e => updLine(i,'gst_rate',e.target.value)}
                                                    className="w-full px-1 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-orange-400"
                                                    style={inp}>
                                                    {['0','5','12','18','28'].map(r => <option key={r} value={r}>{r}%</option>)}
                                                </select>
                                            </td>
                                            {warehouses.length > 1 && (
                                                <td className="px-2 py-1.5 w-28">
                                                    <select value={line.warehouse_id || ''} onChange={e => updLine(i,'warehouse_id',e.target.value)}
                                                        className="w-full px-1 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-orange-400" style={inp}>
                                                        <option value="">Any</option>
                                                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                    </select>
                                                </td>
                                            )}
                                            <td className="px-2 py-1.5 text-right font-bold text-sm whitespace-nowrap w-24" style={{ color: '#FF6B00' }}>
                                                ₹{lineTotal(line).toFixed(2)}
                                            </td>
                                            <td className="px-2 py-1.5 w-8">
                                                <button onClick={() => removeLine(i)} className="p-1 rounded hover:bg-red-50 text-red-400">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Notes */}
                    {lines.length > 0 && (
                        <div className="flex-shrink-0 px-4 py-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                            <input value={notes} onChange={e => setNotes(e.target.value)}
                                placeholder="Notes (optional)…"
                                className="w-full px-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-orange-400"
                                style={inp} />
                        </div>
                    )}
                </div>

                {/* ── RIGHT: SUMMARY + PAYMENT ─────────────────── */}
                <div className="w-72 flex-shrink-0 flex flex-col border-l"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>

                    {/* Invoice meta */}
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>Invoice Details</p>
                        <div className="space-y-2">
                            <div>
                                <label className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Date</label>
                                <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                                    className="w-full mt-0.5 px-2 py-1.5 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-orange-400"
                                    style={inp} />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Doc Discount (₹)</label>
                                <input type="number" min="0" value={docDiscount} onChange={e => setDocDiscount(e.target.value)}
                                    className="w-full mt-0.5 px-2 py-1.5 border rounded-lg text-xs outline-none text-right focus:ring-1 focus:ring-orange-400"
                                    style={inp} />
                            </div>
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="px-4 py-3 border-b space-y-2" style={{ borderColor: 'var(--border-color)' }}>
                        {[
                            ['Subtotal',  fmt(subtotal), false],
                            ['Discounts', `- ${fmt(discLines + docDisc)}`, false],
                            ['GST',       fmt(gstTotal), false],
                            ...(pointsVal > 0     ? [['Points Redeemed', `- ${fmt(pointsVal)}`, false]] : []),
                            ...(exchangeTotal > 0 ? [['Exchange Credit', `- ${fmt(exchangeTotal)}`, false]] : []),
                            ...(totalAdvAdj > 0   ? [['Advance Applied', `- ${fmt(totalAdvAdj)}`, false]] : []),
                            ...(offerSavings > 0  ? [['Offer Savings', `- ${fmt(offerSavings)}`, false]] : []),
                        ].map(([label, val, bold]) => (
                            <div key={label} className="flex justify-between items-center">
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                                <span className={`text-xs ${bold ? 'font-bold' : ''}`} style={{ color: 'var(--text-primary)' }}>{val}</span>
                            </div>
                        ))}
                        <div className="pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Grand Total</span>
                                <span className="text-xl font-extrabold" style={{ color: '#FF6B00' }}>{fmt(Math.max(0, grandTotal))}</span>
                            </div>
                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                                Items: {lines.reduce((s, l) => s + parseFloat(l.qty || 0), 0).toFixed(0)}
                                {' · '}
                                Qty × Rows: {lines.length}
                            </p>
                        </div>
                    </div>

                    {/* Quick action buttons */}
                    <div className="px-4 py-3 space-y-2 flex-1">
                        {savedInvoice ? (
                            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                                <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                                <p className="text-xs font-bold text-emerald-700">{savedInvoice.invoice_number}</p>
                                <p className="text-[10px] text-emerald-600 mt-0.5">
                                    {savedInvoice.status?.toUpperCase()} · {fmt(savedInvoice.paid_amount)} received
                                </p>
                                {parseFloat(savedInvoice.balance) > 0 && (
                                    <p className="text-[10px] text-red-500 font-semibold mt-0.5">Balance: {fmt(savedInvoice.balance)}</p>
                                )}
                            </div>
                        ) : (
                            <>
                                <button onClick={() => lines.length && setShowPayModal(true)}
                                    disabled={!lines.length}
                                    className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                                    style={{ background: '#FF6B00' }}>
                                    <CreditCard className="h-4 w-4" /> Pay & Save (F6)
                                </button>
                                <button onClick={() => lines.length && handleSave()}
                                    disabled={!lines.length || saving}
                                    className="w-full py-2 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2 disabled:opacity-40"
                                    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save as Credit (F9)
                                </button>
                            </>
                        )}

                        {savedInvoice && (
                            <div className="space-y-2">
                                <button onClick={() => printInvoice(savedInvoice, savedInvoice.items || [], savedInvoice.payments || [], customer)}
                                    className="w-full py-2 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2"
                                    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                                    <Printer className="h-4 w-4" /> Print Invoice (F8)
                                </button>
                                <button onClick={handleNewInvoice}
                                    className="w-full py-2 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                                    style={{ background: '#FF6B00' }}>
                                    <Plus className="h-4 w-4" /> New Invoice
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Payment mode quick display */}
                    {!savedInvoice && lines.length > 0 && (
                        <div className="px-4 pb-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>Quick Pay Mode</p>
                            <div className="grid grid-cols-3 gap-1.5">
                                {PAYMENT_MODES.slice(0, 6).map(pm => (
                                    <button key={pm.key}
                                        onClick={() => {
                                            setPayAmounts({ cash: '', upi: '', card: '', bank: '', wallet: '', [pm.key]: String(Math.max(0, grandTotal).toFixed(2)) });
                                            setShowPayModal(true);
                                        }}
                                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all hover:scale-105 ${pm.color}`}>
                                        {pm.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── PAYMENT MODAL ─────────────────────────────────── */}
            {showPayModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
                    <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                            <div>
                                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Payment</h3>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                    Total: <span className="font-bold text-sm" style={{ color: '#FF6B00' }}>{fmt(Math.max(0, grandTotal))}</span>
                                </p>
                            </div>
                            <button onClick={() => setShowPayModal(false)} className="p-1.5 rounded-lg hover:bg-gray-200">
                                <X className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
                            </button>
                        </div>
                        <div className="p-6 space-y-3">
                            {PAYMENT_MODES.slice(0, 5).map(pm => (
                                <div key={pm.key} className="flex items-center gap-3">
                                    <label className={`w-20 text-xs font-bold px-2 py-1 rounded-lg border text-center ${pm.color}`}>{pm.label}</label>
                                    <input type="number" min="0" placeholder="0.00"
                                        value={payAmounts[pm.key]}
                                        onChange={e => setPayAmounts(f => ({ ...f, [pm.key]: e.target.value }))}
                                        className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none text-right focus:ring-2 focus:ring-orange-400"
                                        style={inp} />
                                </div>
                            ))}

                            {/* Cash change calculator */}
                            {parseFloat(payAmounts.cash) > 0 && (
                                <div className="flex items-center gap-3 pt-1 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                    <label className="w-20 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Cash Given</label>
                                    <input type="number" min="0" placeholder="Cash received…"
                                        value={cashGiven}
                                        onChange={e => setCashGiven(e.target.value)}
                                        className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none text-right focus:ring-2 focus:ring-orange-400"
                                        style={inp} />
                                    {parseFloat(cashGiven) > 0 && (
                                        <span className={`text-sm font-bold ${cashChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            Change: {fmt(cashChange)}
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Total Entered</span>
                                <span className={`text-base font-bold ${totalPaid >= grandTotal - 0.01 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {fmt(totalPaid)} / {fmt(Math.max(0, grandTotal))}
                                </span>
                            </div>

                            {totalPaid < grandTotal - 0.01 && customer && (
                                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                                    Balance ₹{fmt(grandTotal - totalPaid)} will be added to customer outstanding
                                </p>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowPayModal(false)}
                                    className="flex-1 py-2.5 text-sm font-semibold rounded-xl border"
                                    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                                    Cancel
                                </button>
                                <button onClick={handleConfirmPayment} disabled={saving}
                                    className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white flex items-center justify-center gap-2 disabled:opacity-60"
                                    style={{ background: '#FF6B00' }}>
                                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                    {saving ? 'Saving…' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── NEW CUSTOMER MODAL ───────────────────────────── */}
            {showNewCust && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
                    <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>New Customer</h3>
                            <button onClick={() => setShowNewCust(false)} className="p-1.5 rounded-lg hover:bg-gray-200">
                                <X className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
                            </button>
                        </div>
                        <div className="p-5 space-y-3">
                            {[['name','Name *','text'],['mobile','Mobile','tel'],['address','Address','text'],['gst_number','GSTIN','text']].map(([k,l,t]) => (
                                <div key={k}>
                                    <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>{l}</label>
                                    <input type={t} className={iCls} style={inp}
                                        value={newCust[k]} onChange={e => setNewCust(f => ({ ...f, [k]: e.target.value }))}
                                        onKeyDown={e => e.key === 'Enter' && k === 'gst_number' && handleCreateCustomer()} />
                                </div>
                            ))}
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => setShowNewCust(false)}
                                    className="flex-1 py-2.5 text-sm font-semibold rounded-xl border"
                                    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleCreateCustomer} disabled={custSaving || !newCust.name.trim()}
                                    className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white disabled:opacity-60"
                                    style={{ background: '#FF6B00' }}>
                                    {custSaving ? 'Creating…' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── RETURN MODAL ─────────────────────────────────── */}
            {showReturnModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
                    <div className="w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ background: 'var(--bg-surface)', maxHeight: '90vh' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                            <div className="flex items-center gap-2">
                                <RotateCcw className="h-5 w-5" style={{ color: '#FF6B00' }} />
                                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Process Return</h3>
                            </div>
                            <button onClick={() => { setShowReturnModal(false); setReturnInvoice(null); setReturnRef(''); }}
                                className="p-1.5 rounded-lg hover:bg-gray-200">
                                <X className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="flex gap-2">
                                <input value={returnRef} onChange={e => setReturnRef(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleReturnLookup()}
                                    placeholder="Enter invoice number (e.g. INV-00001) + Enter"
                                    className="flex-1 px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400"
                                    style={inp} />
                                <button onClick={handleReturnLookup} disabled={returnLoading}
                                    className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                                    style={{ background: '#FF6B00' }}>
                                    {returnLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Load'}
                                </button>
                            </div>

                            {returnInvoice && (
                                <>
                                    <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                                        <div className="flex justify-between">
                                            <div>
                                                <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{returnInvoice.invoice_number}</p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                                    {returnInvoice.customer_name || 'Walk-in'} · {new Date(returnInvoice.invoice_date).toLocaleDateString('en-IN')}
                                                </p>
                                            </div>
                                            <p className="font-bold text-base" style={{ color: '#FF6B00' }}>{fmt(returnInvoice.total_amount)}</p>
                                        </div>
                                    </div>

                                    <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}>
                                                    {['Return','Product','Qty Sold','Return Qty','Unit Price'].map(h => (
                                                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {returnItems.map((item, i) => (
                                                    <tr key={i} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                                                        <td className="px-3 py-2">
                                                            <input type="checkbox" checked={item.selected}
                                                                onChange={e => setReturnItems(r => r.map((x, idx) => idx === i ? { ...x, selected: e.target.checked } : x))}
                                                                className="w-4 h-4 accent-orange-500" />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{item.product_name}</p>
                                                            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                                                                {item.size && `Sz: ${item.size}`} {item.color}
                                                            </p>
                                                        </td>
                                                        <td className="px-3 py-2 text-xs text-center">{item.qty}</td>
                                                        <td className="px-3 py-2 w-24">
                                                            <input type="number" min="0" max={item.qty} step="0.001"
                                                                value={item.return_qty}
                                                                onChange={e => setReturnItems(r => r.map((x, idx) => idx === i ? { ...x, return_qty: e.target.value } : x))}
                                                                disabled={!item.selected}
                                                                className="w-full px-2 py-1 border rounded text-xs text-center outline-none focus:ring-1 focus:ring-orange-400 disabled:opacity-40"
                                                                style={inp} />
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                            {fmt(item.unit_price)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex gap-3">
                                        <button onClick={() => { setShowReturnModal(false); setReturnInvoice(null); setReturnRef(''); }}
                                            className="flex-1 py-2.5 text-sm font-semibold rounded-xl border"
                                            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                                            Cancel
                                        </button>
                                        <button onClick={handleProcessReturn}
                                            className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white"
                                            style={{ background: '#FF6B00' }}>
                                            Process Return
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── ADVANCE MODAL ────────────────────────────────── */}
            {showAdvanceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <div className="flex items-center gap-2">
                                <Wallet className="h-5 w-5 text-indigo-500" />
                                <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>Apply Advance</h3>
                            </div>
                            <button onClick={() => setShowAdvanceModal(false)} className="p-1.5 rounded-lg hover:bg-gray-200"><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 space-y-3">
                            {pendingAdvances.map(adv => {
                                const applied = advanceAdjust.find(a => a.advance_id === adv.id);
                                return (
                                    <div key={adv.id} className="flex items-center gap-3 p-3 border rounded-xl" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold" style={{ color:'var(--text-primary)' }}>Advance #{adv.id}</p>
                                            <p className="text-[10px]" style={{ color:'var(--text-secondary)' }}>{adv.received_date} · {adv.payment_mode?.toUpperCase()}</p>
                                            <p className="text-xs text-indigo-600 font-semibold">Available: {fmt(adv.balance)}</p>
                                        </div>
                                        <input type="number" min={0} max={parseFloat(adv.balance)}
                                            value={applied?.amount || ''}
                                            onChange={e => {
                                                const amt = Math.min(parseFloat(e.target.value)||0, parseFloat(adv.balance));
                                                setAdvanceAdjust(prev => {
                                                    const without = prev.filter(a => a.advance_id !== adv.id);
                                                    return amt > 0 ? [...without, { advance_id: adv.id, amount: amt }] : without;
                                                });
                                            }}
                                            placeholder="0.00"
                                            className="w-28 px-2 py-1.5 border rounded-lg text-sm text-right outline-none focus:ring-2 focus:ring-indigo-400" style={inp} />
                                    </div>
                                );
                            })}
                            <div className="flex justify-between pt-1 border-t text-sm font-bold" style={{ borderColor:'var(--border-color)' }}>
                                <span style={{ color:'var(--text-secondary)' }}>Total Applied</span>
                                <span className="text-indigo-600">{fmt(totalAdvAdj)}</span>
                            </div>
                            <button onClick={() => setShowAdvanceModal(false)}
                                className="w-full py-2.5 text-sm font-bold rounded-xl text-white" style={{ background:'#6366f1' }}>
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── TOAST NOTIFICATION ───────────────────────────── */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold animate-in slide-in-from-bottom-2
                    ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    {toast.type === 'error'
                        ? <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        : <CheckCircle2 className="h-4 w-4 flex-shrink-0" />}
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
