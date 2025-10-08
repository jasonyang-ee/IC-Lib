# API Documentation

## Base URL
```
Development: http://localhost:3001/api
Production: https://your-domain.com/api
```

## Authentication
Currently, no authentication is required. Add authentication middleware for production use.

## Response Format

### Success Response
```json
{
  "data": [...],
  "status": 200
}
```

### Error Response
```json
{
  "error": {
    "message": "Error description",
    "stack": "..." // Only in development
  }
}
```

## Endpoints

### Health Check
```http
GET /api/health
```
Returns server health status.

---

## Dashboard Endpoints

### Get Dashboard Statistics
```http
GET /api/dashboard/stats
```

**Response**:
```json
{
  "totalComponents": 150,
  "totalCategories": 8,
  "totalInventoryItems": 45,
  "totalInventoryQuantity": 523,
  "missingFootprints": 12,
  "lowStockAlerts": 3,
  "recentlyAdded": 15
}
```

### Get Recent Activities
```http
GET /api/dashboard/recent-activities?limit=10
```

### Get Category Breakdown
```http
GET /api/dashboard/category-breakdown
```

---

## Component Endpoints

### Get All Components
```http
GET /api/components?category={uuid}&search={term}&subcategory={name}
```

**Query Parameters**:
- `category` (optional): Filter by category UUID
- `search` (optional): Search in part number, description, MFR part number
- `subcategory` (optional): Filter by subcategory name

**Response**:
```json
[
  {
    "id": "uuid",
    "part_number": "RES-0805-10K",
    "manufacturer_part_number": "RC0805FR-0710KL",
    "description": "Resistor 10K 1% 0805",
    "category_id": "uuid",
    "category_name": "Resistor",
    "manufacturer_id": "uuid",
    "manufacturer_name": "Yageo",
    "subcategory": "Thick Film",
    "footprint_path": "/path/to/footprint.brd",
    "symbol_path": "/path/to/symbol.osm",
    "pad_path": "/path/to/pad.pad",
    "datasheet_url": "https://...",
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-01-15T10:30:00Z"
  }
]
```

### Get Component by ID
```http
GET /api/components/:id
```

### Create Component
```http
POST /api/components
Content-Type: application/json

{
  "category_id": "uuid",
  "part_number": "CAP-0805-10UF",
  "manufacturer_id": "uuid",
  "manufacturer_part_number": "GRM21BR61C106KE15L",
  "description": "Capacitor 10uF 16V X5R 0805",
  "subcategory": "MLCC",
  "datasheet_url": "https://...",
  "footprint_path": "/path/to/footprint.brd",
  "symbol_path": "/path/to/symbol.osm",
  "pad_path": "/path/to/pad.pad",
  "specifications": [
    {
      "key": "Capacitance",
      "value": "10",
      "unit": "uF"
    },
    {
      "key": "Voltage Rating",
      "value": "16",
      "unit": "V"
    }
  ]
}
```

### Update Component
```http
PUT /api/components/:id
Content-Type: application/json

{
  "description": "Updated description",
  "footprint_path": "/new/path/to/footprint.brd"
}
```

### Delete Component
```http
DELETE /api/components/:id
```

### Get Component Specifications
```http
GET /api/components/:id/specifications
```

**Response**:
```json
[
  {
    "id": "uuid",
    "component_id": "uuid",
    "spec_key": "Capacitance",
    "spec_value": "10",
    "spec_unit": "uF",
    "created_at": "2025-01-15T10:30:00Z"
  }
]
```

### Update Component Specifications
```http
PUT /api/components/:id/specifications
Content-Type: application/json

{
  "specifications": [
    {
      "key": "Capacitance",
      "value": "10",
      "unit": "uF"
    },
    {
      "key": "Tolerance",
      "value": "10",
      "unit": "%"
    }
  ]
}
```

### Get Distributor Info
```http
GET /api/components/:id/distributors
```

---

## Category Endpoints

### Get All Categories
```http
GET /api/categories
```

### Create Category
```http
POST /api/categories
Content-Type: application/json

{
  "name": "LED",
  "description": "Light Emitting Diodes",
  "table_name": "leds"
}
```

### Get Components by Category
```http
GET /api/categories/:id/components?limit=100&offset=0
```

---

## Inventory Endpoints

### Get All Inventory
```http
GET /api/inventory
```

### Get Inventory by Component
```http
GET /api/inventory/component/:componentId
```

### Create Inventory Entry
```http
POST /api/inventory
Content-Type: application/json

{
  "component_id": "uuid",
  "location": "Shelf A-5",
  "quantity": 100,
  "minimum_quantity": 20,
  "purchase_date": "2025-01-15",
  "purchase_price": 0.15,
  "notes": "Bulk purchase"
}
```

### Update Inventory
```http
PUT /api/inventory/:id
Content-Type: application/json

{
  "quantity": 80,
  "notes": "Used 20 pieces"
}
```

### Get Low Stock Items
```http
GET /api/inventory/alerts/low-stock
```

---

## Search Endpoints

### Search Digikey
```http
POST /api/search/digikey
Content-Type: application/json

{
  "partNumber": "LM358"
}
```

### Search Mouser
```http
POST /api/search/mouser
Content-Type: application/json

{
  "partNumber": "LM358"
}
```

### Search All Vendors
```http
POST /api/search/all
Content-Type: application/json

{
  "partNumber": "LM358"
}
```

**Response**:
```json
{
  "digikey": {
    "source": "digikey",
    "results": [
      {
        "partNumber": "296-1395-5-ND",
        "manufacturerPartNumber": "LM358DR",
        "manufacturer": "Texas Instruments",
        "description": "IC OPAMP GP 2 CIRCUIT 8SOIC",
        "datasheet": "https://...",
        "pricing": [
          {
            "quantity": 1,
            "price": 0.58,
            "currency": "USD"
          }
        ],
        "stock": 15420,
        "specifications": {
          "Number of Circuits": { "value": "2", "unit": "" },
          "Output Type": { "value": "Rail-to-Rail", "unit": "" }
        },
        "productUrl": "https://..."
      }
    ]
  },
  "mouser": {
    "source": "mouser",
    "results": [...]
  }
}
```

### Download Footprint from Ultra Librarian
```http
POST /api/search/footprint/ultra-librarian
Content-Type: application/json

{
  "partNumber": "LM358DR",
  "componentId": "uuid" // Optional
}
```

### Download Footprint from SnapEDA
```http
POST /api/search/footprint/snapeda
Content-Type: application/json

{
  "partNumber": "LM358DR",
  "componentId": "uuid" // Optional
}
```

---

## Report Endpoints

### Component Summary Report
```http
GET /api/reports/component-summary
```

### Category Distribution Report
```http
GET /api/reports/category-distribution
```

### Inventory Value Report
```http
GET /api/reports/inventory-value
```

### Missing Footprints Report
```http
GET /api/reports/missing-footprints
```

### Manufacturer Report
```http
GET /api/reports/manufacturers
```

### Low Stock Report
```http
GET /api/reports/low-stock
```

### Custom Report
```http
POST /api/reports/custom
Content-Type: application/json

{
  "query": "SELECT * FROM components WHERE category_id = $1 LIMIT 10",
  "params": ["category-uuid"]
}
```

**Note**: Only SELECT queries are allowed for security.

---

## Error Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 201  | Created |
| 400  | Bad Request |
| 404  | Not Found |
| 500  | Internal Server Error |

---

## Rate Limiting

Currently no rate limiting is implemented. Consider adding rate limiting for production:
- Digikey API: 1000 requests/day
- Mouser API: Check your plan limits

---

## Examples

### Complete Workflow: Adding a New Component

1. **Search for part on vendors**:
```bash
curl -X POST http://localhost:3001/api/search/all \
  -H "Content-Type: application/json" \
  -d '{"partNumber": "LM358"}'
```

2. **Create the component**:
```bash
curl -X POST http://localhost:3001/api/components \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": "ic-category-uuid",
    "part_number": "IC-LM358-SOIC8",
    "manufacturer_part_number": "LM358DR",
    "description": "Dual Op-Amp, General Purpose",
    "specifications": [
      {"key": "Package", "value": "SOIC-8", "unit": ""},
      {"key": "Channels", "value": "2", "unit": ""}
    ]
  }'
```

3. **Download footprint**:
```bash
curl -X POST http://localhost:3001/api/search/footprint/ultra-librarian \
  -H "Content-Type: application/json" \
  -d '{"partNumber": "LM358DR", "componentId": "component-uuid"}'
```

4. **Add to inventory**:
```bash
curl -X POST http://localhost:3001/api/inventory \
  -H "Content-Type: application/json" \
  -d '{
    "component_id": "component-uuid",
    "location": "IC-Drawer-3",
    "quantity": 50,
    "minimum_quantity": 10,
    "purchase_price": 0.58
  }'
```

---

For more examples and detailed documentation, see the main README.md
