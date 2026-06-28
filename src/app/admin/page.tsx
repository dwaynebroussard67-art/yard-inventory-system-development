"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { NavBar } from "@/components/NavBar";
import { YardAssistant } from "@/components/YardAssistant";

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  baseUnit: string;
  piecesPerBundle: string | null;
  reorderThreshold: string | null;
}

interface InventoryItem {
  product_id: string;
  name: string;
  sku: string;
  category: string | null;
  base_unit: string;
  reorder_threshold: string | null;
  qty_on_hand: string;
  active_bundles: string;
}

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  active: boolean;
}

interface Customer {
  id: string;
  name: string;
  ref: string | null;
  phone: string | null;
  active: boolean;
}

type AdminTab = "inventory" | "products" | "customers" | "users" | "assistant";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>("inventory");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pSku, setPSku] = useState("");
  const [pName, setPName] = useState("");
  const [pCategory, setPCategory] = useState("");
  const [pUnit, setPUnit] = useState("piece");
  const [pPieces, setPPieces] = useState("");
  const [pThreshold, setPThreshold] = useState("");
  const [pSubmitting, setPSubmitting] = useState(false);
  const [pError, setPError] = useState("");

  // User form
  const [showUserForm, setShowUserForm] = useState(false);
  const [uEmail, setUEmail] = useState("");
  const [uPassword, setUPassword] = useState("");
  const [uName, setUName] = useState("");
  const [uRole, setURole] = useState("crew");
  const [uSubmitting, setUSubmitting] = useState(false);
  const [uError, setUError] = useState("");

  // Customer form
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [cName, setCName] = useState("");
  const [cRef, setCRef] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cSubmitting, setCSubmitting] = useState(false);
  const [cError, setCError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && user.role !== "admin") router.replace("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    fetch("/api/inventory").then((r) => r.json()).then((d) => { setInventory(d.onHand || []); setLowStock(d.lowStock || []); });
    fetch("/api/products").then((r) => r.json()).then((d) => setProducts(d.products || []));
    fetch("/api/users").then((r) => r.json()).then((d) => setUsers(d.users || []));
    fetch("/api/customers").then((r) => r.json()).then((d) => setCustomers(d.customers || []));
  }, [user]);

  const openProductForm = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setPSku(product.sku); setPName(product.name); setPCategory(product.category || "");
      setPUnit(product.baseUnit); setPPieces(product.piecesPerBundle || ""); setPThreshold(product.reorderThreshold || "");
    } else {
      setEditingProduct(null);
      setPSku(""); setPName(""); setPCategory(""); setPUnit("piece"); setPPieces(""); setPThreshold("");
    }
    setShowProductForm(true); setPError("");
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPSubmitting(true); setPError("");
    const body = { sku: pSku, name: pName, category: pCategory, baseUnit: pUnit, piecesPerBundle: pPieces ? Number(pPieces) : null, reorderThreshold: pThreshold ? Number(pThreshold) : null };
    try {
      const res = editingProduct
        ? await fetch(`/api/products/${editingProduct.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setPError(data.error || "Failed"); return; }
      setShowProductForm(false);
      fetch("/api/products").then((r) => r.json()).then((d) => setProducts(d.products || []));
    } catch { setPError("Network error"); }
    finally { setPSubmitting(false); }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUSubmitting(true); setUError("");
    try {
      const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: uEmail, password: uPassword, fullName: uName, role: uRole }) });
      const data = await res.json();
      if (!res.ok) { setUError(data.error || "Failed"); return; }
      setShowUserForm(false); setUEmail(""); setUPassword(""); setUName(""); setURole("crew");
      fetch("/api/users").then((r) => r.json()).then((d) => setUsers(d.users || []));
    } catch { setUError("Network error"); }
    finally { setUSubmitting(false); }
  };

  const openCustomerForm = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setCName(customer.name); setCRef(customer.ref || ""); setCPhone(customer.phone || "");
    } else {
      setEditingCustomer(null);
      setCName(""); setCRef(""); setCPhone("");
    }
    setShowCustomerForm(true); setCError("");
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCSubmitting(true); setCError("");
    const body = { name: cName, ref: cRef, phone: cPhone };
    try {
      const res = editingCustomer
        ? await fetch(`/api/customers/${editingCustomer.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setCError(data.error || "Failed"); return; }
      setShowCustomerForm(false);
      fetch("/api/customers").then((r) => r.json()).then((d) => setCustomers(d.customers || []));
    } catch { setCError("Network error"); }
    finally { setCSubmitting(false); }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm("Archive this customer?")) return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    fetch("/api/customers").then((r) => r.json()).then((d) => setCustomers(d.customers || []));
  };

  if (loading || !user || user.role !== "admin") {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="text-orange-500 text-4xl animate-pulse">🔥</div></div>;
  }

  const tabs: { key: AdminTab; label: string; icon: string }[] = [
    { key: "inventory", label: "Inventory", icon: "📊" },
    { key: "products", label: "Products", icon: "📦" },
    { key: "customers", label: "Customers", icon: "👥" },
    { key: "users", label: "Users", icon: "👤" },
    { key: "assistant", label: "AI", icon: "🤖" },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 sm:pb-6">
        <h1 className="text-2xl font-bold text-white mb-6">Admin</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Inventory Tab */}
        {tab === "inventory" && (
          <div>
            {lowStock.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                <h3 className="text-red-400 font-semibold mb-2">⚠️ Low Stock Alert ({lowStock.length})</h3>
                <div className="space-y-1">
                  {lowStock.map((p) => (
                    <div key={p.product_id} className="flex items-center justify-between text-sm">
                      <span className="text-white">{p.name}</span>
                      <span className="text-red-400">{p.qty_on_hand} / {p.reorder_threshold} {p.base_unit}s</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <h2 className="font-semibold text-white">On-Hand Inventory</h2>
              </div>
              <div className="divide-y divide-slate-800">
                {inventory.map((item) => (
                  <div key={item.product_id} className={`px-4 py-3 flex items-center justify-between ${
                    item.reorder_threshold && Number(item.qty_on_hand) <= Number(item.reorder_threshold)
                      ? "bg-red-500/5"
                      : ""
                  }`}>
                    <div>
                      <div className="text-sm font-medium text-white">{item.name}</div>
                      <div className="text-xs text-slate-400">{item.sku} · {item.active_bundles} bundle{Number(item.active_bundles) !== 1 ? "s" : ""}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${
                        item.reorder_threshold && Number(item.qty_on_hand) <= Number(item.reorder_threshold)
                          ? "text-red-400"
                          : "text-white"
                      }`}>
                        {Number(item.qty_on_hand).toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500">{item.base_unit}s</div>
                    </div>
                  </div>
                ))}
                {inventory.length === 0 && <div className="px-4 py-8 text-center text-slate-500 text-sm">No products yet</div>}
              </div>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {tab === "products" && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={() => openProductForm()} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-xl text-sm">+ Add Product</button>
            </div>

            {showProductForm && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
                <h3 className="font-semibold text-white mb-4">{editingProduct ? "Edit Product" : "New Product"}</h3>
                <form onSubmit={handleProductSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">SKU *</label>
                      <input type="text" value={pSku} onChange={(e) => setPSku(e.target.value)} required placeholder="CED-6FT-PRI" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Name *</label>
                      <input type="text" value={pName} onChange={(e) => setPName(e.target.value)} required placeholder="6ft Cedar Privacy Picket" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Category</label>
                      <input type="text" value={pCategory} onChange={(e) => setPCategory(e.target.value)} placeholder="Fencing" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Base Unit</label>
                      <select value={pUnit} onChange={(e) => setPUnit(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
                        <option value="piece">piece</option>
                        <option value="linear_ft">linear_ft</option>
                        <option value="board_ft">board_ft</option>
                        <option value="bundle">bundle</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Pieces/Bundle</label>
                      <input type="number" value={pPieces} onChange={(e) => setPPieces(e.target.value)} placeholder="200" min={0} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Reorder Threshold</label>
                      <input type="number" value={pThreshold} onChange={(e) => setPThreshold(e.target.value)} placeholder="500" min={0} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                  </div>
                  {pError && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">{pError}</div>}
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowProductForm(false)} className="flex-1 bg-slate-800 text-white py-2.5 rounded-xl text-sm">Cancel</button>
                    <button type="submit" disabled={pSubmitting} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm">{pSubmitting ? "Saving…" : "Save"}</button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="divide-y divide-slate-800">
                {products.map((p) => (
                  <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">{p.name}</div>
                      <div className="text-xs text-slate-400">{p.sku} · {p.baseUnit}{p.category ? ` · ${p.category}` : ""}</div>
                      {p.piecesPerBundle && <div className="text-xs text-slate-500">{p.piecesPerBundle} per bundle</div>}
                    </div>
                    <button onClick={() => openProductForm(p)} className="text-xs text-orange-400 hover:text-orange-300">Edit</button>
                  </div>
                ))}
                {products.length === 0 && <div className="px-4 py-8 text-center text-slate-500 text-sm">No products yet</div>}
              </div>
            </div>
          </div>
        )}

        {/* Customers Tab */}
        {tab === "customers" && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={() => openCustomerForm()} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-xl text-sm">+ Add Customer</button>
            </div>

            {showCustomerForm && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
                <h3 className="font-semibold text-white mb-4">{editingCustomer ? "Edit Customer" : "New Customer"}</h3>
                <form onSubmit={handleCustomerSubmit} className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Name *</label>
                      <input type="text" value={cName} onChange={(e) => setCName(e.target.value)} required placeholder="Acme Construction" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Account Ref</label>
                      <input type="text" value={cRef} onChange={(e) => setCRef(e.target.value)} placeholder="ACME-001" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Phone</label>
                      <input type="text" value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="555-0100" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                  </div>
                  {cError && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">{cError}</div>}
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowCustomerForm(false)} className="flex-1 bg-slate-800 text-white py-2.5 rounded-xl text-sm">Cancel</button>
                    <button type="submit" disabled={cSubmitting} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm">{cSubmitting ? "Saving…" : "Save"}</button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="divide-y divide-slate-800">
                {customers.filter((c) => c.active).map((c) => (
                  <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">{c.name}</div>
                      <div className="text-xs text-slate-400">{[c.ref, c.phone].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openCustomerForm(c)} className="text-xs text-orange-400 hover:text-orange-300">Edit</button>
                      <button onClick={() => handleDeleteCustomer(c.id)} className="text-xs text-red-400 hover:text-red-300">Archive</button>
                    </div>
                  </div>
                ))}
                {customers.filter((c) => c.active).length === 0 && <div className="px-4 py-8 text-center text-slate-500 text-sm">No customers yet</div>}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={() => setShowUserForm(!showUserForm)} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-xl text-sm">+ Add User</button>
            </div>

            {showUserForm && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
                <h3 className="font-semibold text-white mb-4">New User</h3>
                <form onSubmit={handleUserSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Full Name *</label>
                      <input type="text" value={uName} onChange={(e) => setUName(e.target.value)} required placeholder="Jane Smith" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Email *</label>
                      <input type="email" value={uEmail} onChange={(e) => setUEmail(e.target.value)} required placeholder="jane@yard.com" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Password *</label>
                      <input type="password" value={uPassword} onChange={(e) => setUPassword(e.target.value)} required placeholder="Min 6 chars" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Role</label>
                      <select value={uRole} onChange={(e) => setURole(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
                        <option value="crew">Crew</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  {uError && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">{uError}</div>}
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowUserForm(false)} className="flex-1 bg-slate-800 text-white py-2.5 rounded-xl text-sm">Cancel</button>
                    <button type="submit" disabled={uSubmitting} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm">{uSubmitting ? "Creating…" : "Create User"}</button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="divide-y divide-slate-800">
                {users.map((u) => (
                  <div key={u.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">{u.fullName}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      u.role === "admin" ? "bg-orange-500/20 text-orange-400" : "bg-slate-700 text-slate-300"
                    }`}>{u.role}</span>
                  </div>
                ))}
                {users.length === 0 && <div className="px-4 py-8 text-center text-slate-500 text-sm">No users</div>}
              </div>
            </div>
          </div>
        )}

        {/* AI Assistant Tab */}
        {tab === "assistant" && <YardAssistant />}
      </main>
    </div>
  );
}
