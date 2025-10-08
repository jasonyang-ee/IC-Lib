# Allegro Component Library Management System

A full-stack web application for managing OrCAD Allegro CIS component libraries with integrated distributor search and footprint download capabilities.

## 🚀 Features

### Core Features
- **Dashboard**: Real-time statistics and overview of component library
- **Component Library Management**: Browse, search, add, edit, and delete components
- **Inventory Tracking**: Monitor stock levels with low-stock alerts
- **Online Vendor Search**: Search Digikey and Mouser APIs for component information
- **Footprint Downloads**: Automatic footprint downloads from Ultra Librarian and SnapEDA
- **Reports**: Generate various reports for auditing and analysis

### Technical Features
- PostgreSQL 18 database with flexible schema design
- RESTful API backend with Express.js
- React + Vite frontend with Tailwind CSS
- Docker containerization for easy deployment
- Responsive design for desktop and tablet

## 📋 Prerequisites

- Node.js 20+ and npm
- PostgreSQL 18 (or use Docker)
- Docker and Docker Compose (for containerized deployment)
- API Keys (optional, for full functionality):
  - Digikey API credentials
  - Mouser API key
  - Ultra Librarian token
  - SnapEDA API key

## 🛠️ Technology Stack

### Frontend
- React 19
- Vite 7
- Tailwind CSS
- React Router
- TanStack Query (React Query)
- Axios
- Lucide React (icons)

### Backend
- Node.js
- Express.js
- PostgreSQL 18
- pg (node-postgres)
- Axios (for API integrations)

### DevOps
- Docker
- Docker Compose
- Nginx (production)

## 📦 Installation

### Option 1: Using Existing PostgreSQL Server (Your Setup)

Perfect if you already have PostgreSQL running on a separate server.

1. **Initialize Your Database**
   
   Your database server is already running at `infra.main.local:5435`.
   
   Run the initialization script:
   ```bash
   cd scripts
   npm install
   npm run init-db
   ```
   
   This will:
   - Create all required tables, indexes, and triggers
   - Optionally load sample data
   - Verify the installation
   
   See [DATABASE_SETUP.md](DATABASE_SETUP.md) for detailed instructions.

2. **Configure Backend Environment**
   ```bash
   cd server
   # .env is already configured for your database
   # Optionally add API keys for vendor search
   ```

3. **Install Backend Dependencies**
   ```bash
   npm install
   ```

4. **Start Backend Server**
   ```bash
   npm run dev
   ```
   Backend will run on http://localhost:3001

5. **Configure Frontend**
   ```bash
   cd ../client
   # .env is already configured for local development
   ```

6. **Start Frontend Development Server**
   ```bash
   npm run dev
   ```
   Frontend will run on http://localhost:5173

### Option 2: Development Setup with Docker (Alternative)

If you prefer to use Docker for the database:

1. **Start PostgreSQL Database with Docker**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```
   This will start PostgreSQL on port 5435 and automatically initialize the schema.

2. **Configure Backend Environment**
   ```bash
   cd server
   cp .env.example .env
   # Edit .env with your API keys (optional for development)
   ```

3. **Install Backend Dependencies**
   ```bash
   npm install
   ```

4. **Start Backend Server**
   ```bash
   npm run dev
   ```
   Backend will run on http://localhost:3001

5. **Configure Frontend**
   ```bash
   cd ../client
   # .env is already configured for local development
   ```

6. **Start Frontend Development Server**
   ```bash
   npm run dev
   ```
   Frontend will run on http://localhost:5173

### Option 2: Full Docker Deployment (Production)

**The application now uses a unified Docker container with both frontend and backend.**

1. **Initialize Database First**
   ```bash
   cd scripts
   npm run init-db
   ```

2. **Configure Database Connection**
   Edit `docker-compose.yml` and update the environment variables:
   ```yaml
   environment:
     - DB_HOST=infra.main.local  # Your PostgreSQL host
     - DB_PORT=5435              # Your PostgreSQL port
     - DB_USER=sami
     - DB_PASSWORD=123456
     - DB_NAME=cip
   ```

3. **Build and Start the Application**
   ```bash
   docker-compose up -d
   ```

4. **View Logs**
   ```bash
   docker-compose logs -f web
   ```

5. **Access the Application**
   - Frontend: http://localhost
   - Backend API: http://localhost:3001/api (or via nginx at http://localhost/api)
   - Health Check: http://localhost/health

6. **Stop the Application**
   ```bash
   docker-compose down
   ```

For detailed Docker deployment documentation, see `DOCKER_DEPLOYMENT.md`.

## 🗄️ Database Schema

### Main Tables

#### `components`
Master table for all components with common fields:
- Part number, manufacturer info
- CAD file paths (footprint, symbol, pad)
- Category and subcategory
- Timestamps and metadata

#### `component_specifications`
Flexible key-value store for component-specific specifications:
- Allows different components to have different specs
- Supports units and values

#### `component_categories`
Component categories (Resistor, Capacitor, IC, etc.):
- Dynamically expandable
- Each category has a unique table name

#### `distributor_info`
Pricing and stock information from vendors:
- Links components to distributors
- Stores price breaks as JSONB
- Tracks last update timestamp

#### `inventory`
In-house inventory tracking:
- Quantity and location
- Minimum stock levels
- Purchase history

#### `footprint_sources`
Tracks footprint download sources:
- Ultra Librarian, SnapEDA, or manual
- Download URLs and timestamps

### Key Features of Schema
- UUID primary keys for all tables
- Automatic timestamp updates with triggers
- Flexible specification storage
- Normalized design with proper relationships
- Optimized indexes for common queries

## 🔌 API Endpoints

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/recent-activities` - Get recent activities
- `GET /api/dashboard/category-breakdown` - Get category distribution

### Components
- `GET /api/components` - Get all components (with filters)
- `GET /api/components/:id` - Get component by ID
- `POST /api/components` - Create new component
- `PUT /api/components/:id` - Update component
- `DELETE /api/components/:id` - Delete component
- `GET /api/components/:id/specifications` - Get specifications
- `PUT /api/components/:id/specifications` - Update specifications
- `GET /api/components/:id/distributors` - Get distributor info

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:id` - Get category by ID
- `POST /api/categories` - Create new category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category
- `GET /api/categories/:id/components` - Get components in category

### Inventory
- `GET /api/inventory` - Get all inventory
- `GET /api/inventory/:id` - Get inventory item by ID
- `GET /api/inventory/component/:componentId` - Get inventory for component
- `POST /api/inventory` - Create inventory entry
- `PUT /api/inventory/:id` - Update inventory
- `DELETE /api/inventory/:id` - Delete inventory
- `GET /api/inventory/alerts/low-stock` - Get low stock alerts

### Vendor Search
- `POST /api/search/digikey` - Search Digikey
- `POST /api/search/mouser` - Search Mouser
- `POST /api/search/all` - Search all vendors
- `POST /api/search/footprint/ultra-librarian` - Download from Ultra Librarian
- `POST /api/search/footprint/snapeda` - Download from SnapEDA

### Reports
- `GET /api/reports/component-summary` - Component summary by category
- `GET /api/reports/category-distribution` - Category distribution
- `GET /api/reports/inventory-value` - Inventory value report
- `GET /api/reports/missing-footprints` - Missing footprints report
- `GET /api/reports/manufacturers` - Manufacturer report
- `GET /api/reports/low-stock` - Low stock report
- `POST /api/reports/custom` - Custom SQL query report

## 🔑 API Configuration

### Digikey API
1. Register at https://developer.digikey.com
2. Create an application
3. Add credentials to `.env`:
   ```
   DIGIKEY_CLIENT_ID=your_client_id
   DIGIKEY_CLIENT_SECRET=your_client_secret
   ```

### Mouser API
1. Register at https://www.mouser.com/api-hub/
2. Get API key
3. Add to `.env`:
   ```
   MOUSER_API_KEY=your_api_key
   ```

### Ultra Librarian
1. Contact Ultra Librarian for API access
2. Add token to `.env`:
   ```
   ULTRA_LIBRARIAN_TOKEN=your_token
   ```

### SnapEDA
1. Register at https://www.snapeda.com/api/
2. Add API key to `.env`:
   ```
   SNAPEDA_API_KEY=your_api_key
   ```

**Note**: The application will work without API keys, but vendor search and footprint download features will return mock errors.

## 📁 Project Structure

```
allegroSQL/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── utils/         # Utilities and API client
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── server/                 # Express backend
│   ├── src/
│   │   ├── config/        # Database configuration
│   │   ├── controllers/   # Route controllers
│   │   ├── routes/        # API routes
│   │   ├── services/      # External API services
│   │   └── index.js       # Server entry point
│   ├── Dockerfile
│   ├── .env
│   └── package.json
├── database/               # Database files
│   └── schema.sql         # PostgreSQL schema
├── docker-compose.yml      # Production Docker setup
├── docker-compose.dev.yml  # Development Docker setup
└── README.md
```

## 🚀 Usage Guide

### Adding a New Component

1. Navigate to **Vendor Search** page
2. Search for the part number on Digikey/Mouser
3. Select the desired part from results
4. Click **Add to Library**
5. System will attempt to download footprint automatically
6. Component will appear in the **Library** page

### Managing Inventory

1. Navigate to **Inventory** page
2. View all inventory items with stock levels
3. Low stock items are highlighted in red
4. Update quantities as needed

### Generating Reports

1. Navigate to **Reports** page
2. Select report type from the left sidebar
3. View the generated report
4. Export to CSV if needed

### Editing Components

1. Navigate to **Library** page
2. Select a category or search for a component
3. Click on a component to view details
4. Click **Edit Component**
5. Modify fields as needed
6. Click **Save Changes**

## 🐛 Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running on port 5435
- Check credentials in `.env` file
- Ensure firewall allows connections

### API Key Errors
- Vendor search features require valid API keys
- The app will work without them but with limited functionality
- Check `.env` configuration

### Docker Issues
- Ensure Docker daemon is running
- Check port availability (5173, 3001, 5435)
- Use `docker-compose logs` to view errors

## 📝 Development Notes

### Adding New Categories
Categories can be added through the API or directly in the database:
```sql
INSERT INTO component_categories (name, description, table_name) 
VALUES ('LED', 'Light Emitting Diodes', 'leds');
```

### Custom Queries
Use the custom report endpoint for specific queries:
```javascript
POST /api/reports/custom
{
  "query": "SELECT * FROM components WHERE category_id = $1",
  "params": ["category-uuid-here"]
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - feel free to use this project for your needs.

## 👤 Author

Created for managing Allegro CIS component libraries.

## 🔄 Future Enhancements

- [ ] Bulk import from CSV
- [ ] Advanced search with filters
- [ ] User authentication and authorization
- [ ] Audit trail for changes
- [ ] Email notifications for low stock
- [ ] BOM (Bill of Materials) management
- [ ] Integration with more CAD footprint sources
- [ ] Mobile app
- [ ] Real-time collaboration features

## 📞 Support

For issues and questions:
- Check the documentation above
- Review API endpoint documentation
- Check database schema
- Verify environment configuration

---

**Note**: This is a development/internal tool. Make sure to secure the application properly before exposing it to the internet.
