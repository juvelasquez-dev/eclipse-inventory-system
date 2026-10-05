# Eclipse Inventory & Distribution Management System (EIDMS)

EIDMS is an internal **Inventory, Distribution, and Point-of-Sale Management System** developed for **Eclipse Food Trading OPC**, a distributor of Dan Eric's Grand Ice Cream.

The system is designed to manage inventory movements, products, stock levels, point-of-sale transactions, outlet orders, users, and distribution operations through a centralized web application.

## 🚀 Live System

**Production:**
https://eclipse-inventory-system.vercel.app

> **Note:** EIDMS is an internal business application. Access to the production system is restricted to authorized users.

---

## 📌 Features

### 📦 Inventory Management

* Product management
* Stock In for incoming deliveries
* Stock Out for warehouse inventory movements
* Stock adjustments
* Current inventory monitoring
* Inventory transaction history
* Inventory movement tracking
* Low-stock monitoring
* Pagination and inventory statistics

### 🛒 Point of Sale

* POS transaction processing
* Product selection and cart management
* Transaction totals
* Receipt generation
* Receipt numbering by operating area
* POS transaction history
* Transaction cancellation
* Automatic inventory deduction after completed sales

### 🏪 Outlet & Distribution Management

* Outlet management
* Area-based operations
* Outlet ordering
* Distribution-related inventory movements
* Operating-area attribution

### 👥 User & System Administration

* User authentication
* User management
* System administration
* User account management
* Supabase Auth integration

### 📊 Reports & Data

* Inventory history
* Transaction history
* Inventory statistics
* Charts and dashboards
* Excel import/export
* Stock transaction importing

---

## 🏗️ System Architecture

EIDMS uses a modern web application architecture:

```text
┌─────────────────────────────┐
│        React Frontend       │
│      TypeScript + Vite      │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│        Supabase Auth        │
│      User Authentication    │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│      Supabase PostgreSQL    │
│       Database + RLS        │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│    SECURITY DEFINER RPCs    │
│   Validated Server Actions  │
└─────────────────────────────┘
```

### Technology Stack

| Category               | Technology            |
| ---------------------- | --------------------- |
| Frontend               | React                 |
| Language               | TypeScript            |
| Build Tool             | Vite                  |
| Styling                | Tailwind CSS          |
| Routing                | React Router          |
| Backend / Database     | Supabase              |
| Database               | PostgreSQL            |
| Authentication         | Supabase Auth         |
| Authorization          | PostgreSQL RLS        |
| Server-side Operations | SECURITY DEFINER RPCs |
| Charts                 | Recharts              |
| Icons                  | Lucide React          |
| Excel Processing       | SheetJS (`xlsx`)      |
| Hosting                | Vercel                |

---

## 📁 Project Structure

```text
src/
├── components/
│   ├── common/
│   ├── inventory/
│   ├── pos/
│   └── ...
│
├── contexts/
│   └── InventoryProvider.tsx
│
├── hooks/
│
├── lib/
│   ├── supabase.ts
│   └── ...
│
├── pages/
│   ├── Products/
│   ├── Inventory/
│   ├── StockIn/
│   ├── StockOut/
│   ├── POS/
│   ├── History/
│   └── ...
│
├── types/
│
├── App.tsx
└── main.tsx
```

---

## 🔐 Security

EIDMS uses multiple layers of application and database security.

### Authentication

User authentication is handled through **Supabase Auth**.

User passwords are managed by Supabase Auth rather than being stored directly by the application.

### Row Level Security

PostgreSQL **Row Level Security (RLS)** is used to enforce database-level access policies on protected resources.

### Server-side Database Operations

Selected business-critical operations are handled through PostgreSQL functions using `SECURITY DEFINER` where appropriate.

These operations provide server-side validation for operations such as:

* POS transactions
* Inventory movements
* Receipt numbering
* Stock operations

> Security configuration and database policies are subject to ongoing review and hardening.

---

## 🔄 Inventory & POS Integration

EIDMS integrates POS transactions with inventory management.

When a valid POS transaction is completed, the transaction flow includes:

```text
POS Checkout
     │
     ▼
Create POS Transaction
     │
     ▼
Create Transaction Items
     │
     ▼
Inventory OUT Movement
     │
     ▼
Update Available Stock
```

This keeps completed sales and inventory movements synchronized within the system.

---

## 🧾 Receipt Numbering

Receipt numbers are associated with the operating area rather than individual cashiers.

Current area codes include:

| Code | Area                 |
| ---- | -------------------- |
| IAO  | Siargao              |
| CBR  | Cabadbaran           |
| EFT  | Eclipse Food Trading |

This allows transactions to be identified according to their operating area.

---

## 📊 Data Flow

A simplified system flow:

```text
                    ┌───────────────┐
                    │    Users      │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Supabase     │
                    │     Auth      │
                    └───────┬───────┘
                            │
                            ▼
┌─────────────┐      ┌───────────────┐      ┌─────────────┐
│  Products   │─────▶│     EIDMS     │◀─────│  Inventory  │
└─────────────┘      └───────┬───────┘      └─────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
             ┌─────────────┐     ┌─────────────┐
             │     POS     │     │   Outlets   │
             └──────┬──────┘     └─────────────┘
                    │
                    ▼
             ┌─────────────┐
             │ Transactions│
             └─────────────┘
```

---

## 🛠️ Local Development

### Prerequisites

Make sure you have installed:

* Node.js
* npm
* Git

### Clone the repository

Replace `<YOUR_GITHUB_USERNAME>` and `<YOUR_REPOSITORY_NAME>` with the actual GitHub repository information.

```bash
git clone https://github.com/juvelasquez-dev/eclipse-inventory-system
cd eclipse-inventory-system
```

### Install dependencies

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> Never commit `.env.local` or other files containing private credentials to the repository.

### Start the development server

```bash
npm run dev
```

The application will normally be available at:

```text
http://localhost:5173
```

---

## 🧪 Available Scripts

### Development

```bash
npm run dev
```

Starts the Vite development server.

### Production Build

```bash
npm run build
```

Builds the application for production.

### Lint

```bash
npm run lint
```

Runs ESLint checks.

### Preview

```bash
npm run preview
```

Previews the production build locally.

---

## ☁️ Deployment

The production frontend is deployed using **Vercel**.

The application connects to Supabase for:

* Authentication
* PostgreSQL database
* Row Level Security
* Database functions and RPCs

Typical deployment flow:

```text
GitHub
   │
   ▼
Vercel
   │
   ▼
React + Vite Application
   │
   ▼
Supabase
   ├── Auth
   ├── PostgreSQL
   ├── RLS
   └── RPC Functions
```

---

## 🔒 Privacy & Data

EIDMS is an internal business system and may process information associated with:

* Employee and user accounts
* Product and inventory records
* Outlet information
* POS transactions
* Customer information recorded during transactions
* Operational and transaction history

Production data should only be accessible to authorized personnel.

Privacy and compliance requirements for the system are subject to the organization's applicable policies and legal requirements.

---

## 📋 Development Status

EIDMS is currently **deployed and operational for internal business use**.

Implemented modules and functionality include:

* [x] Authentication
* [x] Product management
* [x] Inventory management
* [x] Stock In
* [x] Stock Out
* [x] Stock adjustments
* [x] POS transactions
* [x] POS → Inventory integration
* [x] Receipt numbering
* [x] Transaction history
* [x] Outlet management
* [x] Outlet ordering
* [x] User management
* [x] System administration
* [x] Excel import/export
* [x] Production deployment

The system continues to undergo security hardening, privacy and compliance review, monitoring improvements, and other production-readiness improvements.

---

## 👨‍💻 Developer

**Justine Velasquez**

BS Information Technology
Web & Systems Development

---

## 📄 License

This software is proprietary and intended for internal use by **Eclipse Food Trading OPC**.

Unauthorized copying, distribution, modification, or commercial use is prohibited unless authorized by the system owner.
