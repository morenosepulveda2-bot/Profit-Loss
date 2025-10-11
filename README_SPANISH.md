# Aplicación Profit & Loss

Aplicación completa de gestión financiera con análisis de ingresos, gastos y reportes detallados.

## Características Principales

### 1. Autenticación
- Registro e inicio de sesión con JWT
- Contraseñas encriptadas con bcrypt
- Sesiones seguras

### 2. Gestión de Ventas e Ingresos
- **Ingreso Manual**: Crea ventas individuales con fecha, monto, categoría, método de pago y descripción
- **Importación CSV**: Importa múltiples ventas desde archivos CSV
- **Integración Toast POS**: (Próximamente) Sincroniza ventas automáticamente desde Toast POS
- Editar y eliminar ventas
- Ver historial completo de ventas

### 3. Gestión de Gastos
- Registra gastos con fecha, monto, categoría y descripción
- CRUD completo (Crear, Ver, Editar, Eliminar)
- Organización por categorías

### 4. Categorías
- **Categorías Predefinidas** (no se pueden editar/eliminar):
  - Ingresos: Ventas de Productos, Servicios, Propinas, Otros Ingresos
  - Gastos: Renta, Nómina, Inventario, Marketing, Servicios Públicos, Mantenimiento, Otros Gastos
- **Categorías Personalizadas**: Crea tus propias categorías para ingresos y gastos
- CRUD completo para categorías personalizadas

### 5. Dashboard Financiero
- Métricas en tiempo real:
  - Ingresos Totales
  - Gastos Totales
  - Ganancia Neta
  - Margen de Ganancia
- Gráficos interactivos:
  - Comparación mensual de ingresos, gastos y ganancias
  - Distribución de ingresos por categoría
  - Distribución de gastos por categoría
  - Métodos de pago utilizados

### 6. Reportes y Análisis
- **Filtros disponibles**:
  - Esta Semana
  - Este Mes
  - Este Trimestre
  - Este Año
  - Rango Personalizado
- **Visualizaciones**:
  - Gráfico de tendencia de crecimiento mensual
  - Comparación mes a mes con porcentaje de crecimiento
  - Desglose detallado por categorías
- **Exportación**: Descarga reportes en formato CSV

## Formato CSV para Importación de Ventas

Para importar ventas mediante CSV, el archivo debe tener las siguientes columnas:

```csv
date,amount,category_id,payment_method,description
2024-01-15,150.50,<id_categoria>,Efectivo,Venta de productos
2024-01-16,200.00,<id_categoria>,Tarjeta,Servicio de consultoría
2024-01-17,75.25,<id_categoria>,Transferencia,Venta online
```

### Columnas requeridas:
- **date**: Fecha en formato YYYY-MM-DD
- **amount**: Monto numérico (puede tener decimales)
- **category_id**: ID de la categoría de ingreso (obtén los IDs desde la sección Categorías)
- **payment_method**: Método de pago (Efectivo, Tarjeta, Transferencia, Otro)

### Columnas opcionales:
- **description**: Descripción adicional de la venta

### Pasos para importar CSV:
1. Ve a la página "Ventas"
2. Haz clic en "Importar CSV"
3. Selecciona tu archivo CSV
4. Las ventas se importarán automáticamente

## Cómo Obtener el ID de una Categoría

1. Ve a la página "Categorías"
2. Abre las herramientas de desarrollador del navegador (F12)
3. Inspecciona una categoría y busca el atributo `data-testid` o el ID en la consola
4. También puedes usar la API directamente: `GET /api/categories`

## Ejemplo de Flujo de Trabajo

### Configuración Inicial:
1. Registra una cuenta nueva
2. Las categorías predefinidas se crean automáticamente
3. (Opcional) Crea categorías personalizadas según tu negocio

### Uso Diario:
1. **Registra ventas**:
   - Manualmente una por una
   - O importa múltiples ventas desde CSV
2. **Registra gastos** del día
3. **Revisa el dashboard** para ver tu desempeño

### Análisis Periódico:
1. Ve a "Reportes"
2. Selecciona el período que deseas analizar
3. Revisa las métricas y gráficos
4. Compara el crecimiento mes a mes
5. Exporta el reporte en CSV si lo necesitas

## API Endpoints Disponibles

### Autenticación
- `POST /api/auth/register` - Registrar nuevo usuario
- `POST /api/auth/login` - Iniciar sesión

### Categorías
- `GET /api/categories` - Obtener todas las categorías
- `POST /api/categories` - Crear nueva categoría
- `PUT /api/categories/{id}` - Actualizar categoría
- `DELETE /api/categories/{id}` - Eliminar categoría

### Ventas
- `GET /api/sales` - Obtener todas las ventas
- `POST /api/sales` - Crear nueva venta
- `PUT /api/sales/{id}` - Actualizar venta
- `DELETE /api/sales/{id}` - Eliminar venta
- `POST /api/sales/import-csv` - Importar ventas desde CSV

### Gastos
- `GET /api/expenses` - Obtener todos los gastos
- `POST /api/expenses` - Crear nuevo gasto
- `PUT /api/expenses/{id}` - Actualizar gasto
- `DELETE /api/expenses/{id}` - Eliminar gasto

### Dashboard y Análisis
- `GET /api/dashboard/summary` - Resumen del dashboard
- `GET /api/dashboard/comparison?months=12` - Comparación mensual
- `GET /api/analytics/report?filter_type=month` - Reporte con filtros

## Próximas Características

- Integración con Toast POS API
- Soporte para múltiples monedas
- Recordatorios de gastos recurrentes
- Proyecciones financieras
- Exportación de reportes en PDF
- Notificaciones por email

## Soporte

Para soporte técnico o preguntas, contacta al equipo de desarrollo.
