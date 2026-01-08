// AutoAnimate - Filter & Sort List Example
// Common use case: Animated filtering and sorting

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useMemo, useState } from "react";

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
}

const products: Product[] = [
  { id: 1, name: "Laptop", category: "Electronics", price: 999 },
  { id: 2, name: "Coffee Mug", category: "Home", price: 15 },
  { id: 3, name: "Headphones", category: "Electronics", price: 199 },
  { id: 4, name: "Notebook", category: "Office", price: 5 },
  { id: 5, name: "Desk Lamp", category: "Home", price: 45 },
];

export function FilterSortExample() {
  const [parent] = useAutoAnimate();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "price">("name");

  // Filtered and sorted products (animations trigger on changes)
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesSearch = p.name
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesCategory = category === "all" || p.category === category;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return a.price - b.price;
      });
  }, [search, category, sortBy]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      {/* Filters */}
      <div className="flex gap-4">
        <input
          className="flex-1 rounded border px-3 py-2"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          type="text"
          value={search}
        />
        <select
          className="rounded border px-3 py-2"
          onChange={(e) => setCategory(e.target.value)}
          value={category}
        >
          <option value="all">All Categories</option>
          <option value="Electronics">Electronics</option>
          <option value="Home">Home</option>
          <option value="Office">Office</option>
        </select>
        <select
          className="rounded border px-3 py-2"
          onChange={(e) => setSortBy(e.target.value as "name" | "price")}
          value={sortBy}
        >
          <option value="name">Sort by Name</option>
          <option value="price">Sort by Price</option>
        </select>
      </div>

      {/* Animated product list */}
      <ul className="space-y-2" ref={parent}>
        {filteredProducts.map((product) => (
          <li
            className="flex items-center justify-between rounded border bg-white p-4 shadow-sm"
            key={product.id}
          >
            <div>
              <h3 className="font-semibold">{product.name}</h3>
              <p className="text-gray-600 text-sm">{product.category}</p>
            </div>
            <span className="font-bold text-blue-600 text-lg">
              ${product.price}
            </span>
          </li>
        ))}

        {filteredProducts.length === 0 && (
          <li className="p-8 text-center text-gray-500">
            No products match your filters
          </li>
        )}
      </ul>
    </div>
  );
}
