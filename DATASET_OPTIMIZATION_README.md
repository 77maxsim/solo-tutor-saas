# Dataset Optimization System

## Overview

The Classter application includes an intelligent dataset optimization system that automatically adapts to any account size, preventing performance issues for users with large datasets (500+ sessions).

## How It Works

### Automatic Detection
- **Threshold**: 500+ sessions triggers optimization
- **Caching**: Session counts cached for 5 minutes to avoid repeated checks
- **Global**: Works for any tutor account, not hardcoded to specific users

### Query Strategies

#### Standard Query (< 500 sessions)
```sql
SELECT sessions.*, students.name 
FROM sessions 
JOIN students ON sessions.student_id = students.id 
WHERE sessions.tutor_id = ?
```

#### Optimized Query (500+ sessions)
```sql
-- Separate queries to avoid expensive joins
SELECT * FROM sessions WHERE tutor_id = ?
SELECT id, name FROM students WHERE tutor_id = ?
-- Combined in JavaScript
```

---

## Paginated Batch Fetching

### The Problem

Supabase enforces an implicit ~1000 row limit on queries. When a tutor has more than 1000 sessions, a simple query like `SELECT * FROM sessions WHERE tutor_id = ?` will only return the first 1000 rows, causing **data loss**.

### The Solution: Batch Fetching

Instead of one query, the system fetches data in batches of 1000 using Supabase's `.range()` method:

```javascript
// Batch fetching approach
const BATCH_SIZE = 1000;
let batch = 0;
let allSessions = [];

while (hasMore && batch < MAX_BATCHES) {
  const { data } = await supabase
    .from('sessions')
    .range(batch * BATCH_SIZE, (batch + 1) * BATCH_SIZE - 1);
  
  allSessions.push(...data);
  hasMore = data.length === BATCH_SIZE;
  batch++;
}
```

### Implementation Details

#### Tutor Dashboard (Client-Side)
Located in `client/src/lib/queryOptimizer.ts`:

| Setting | Value | Purpose |
|---------|-------|---------|
| `BATCH_SIZE` | 1,000 | Rows per batch |
| `MAX_BATCHES` | 20 | Safety limit |
| **Max Sessions** | 20,000 | Per tutor |

Features:
- **Deduplication**: Uses `Set` to prevent duplicate sessions across batches
- **Graceful Degradation**: Falls back to standard query if batch fetching fails
- **Performance Logging**: Tracks batch count and execution time

#### Admin Dashboard (Server-Side)
Located in `server/routes.ts`:

| Setting | Value | Purpose |
|---------|-------|---------|
| `BATCH_SIZE` | 1,000 | Rows per batch |
| `MAX_BATCHES` | 30 | Safety limit (higher for admin) |
| **Max Sessions** | 30,000 | Across all tutors |

Used as fallback when RPC functions are not installed.

### Console Logging

Tutor dashboard logs:
```
🔥 PAGINATED FETCH: Starting batch retrieval...
🔥 Batch 1: Retrieved 1000 sessions (range 0-999)
🔥 Batch 2: Retrieved 1000 sessions (range 1000-1999)
🔥 Batch 3: Retrieved 387 sessions (range 2000-2999)
🔥 Pagination complete: Last batch had 387 rows (< 1000)
```

### When It Activates

| Context | Trigger | Max Sessions |
|---------|---------|--------------|
| Tutor Dashboard | 500+ sessions | 20,000 |
| Admin Dashboard (Fallback) | RPC not available | 30,000 |

### Safety Features

1. **Maximum Batch Limit**: Prevents infinite loops
2. **Deduplication**: Handles potential overlapping rows
3. **Error Recovery**: Continues with partial data if a batch fails
4. **Fallback Chain**: Optimized → Standard → Empty array

## Safety Measures

### Performance Monitoring
- Query execution time tracking
- Performance rating system (Excellent/Good/Fair/Needs Optimization)
- Automatic alerts for slow queries (>5 seconds)
- Recommendations for datasets >5,000 sessions

### Error Handling
- **Graceful Degradation**: Falls back to standard query if optimization fails
- **Ultimate Fallback**: Returns empty array if all queries fail (prevents app crash)
- **Partial Recovery**: Continues with partial data if student names can't be loaded

### Data Integrity
- **Complete Sessions**: All sessions (paid/unpaid) are fetched for calendar views
- **Consistent Logic**: Same calculation formulas across all components
- **Real-time Sync**: Cache invalidation on data updates

## Components Using Optimization

1. **Calendar** ✅ - Shows all sessions for scheduling
2. **Dashboard** ✅ - Statistical calculations
3. **Earnings** ✅ - Financial reporting
4. **Students** ✅ - Student management

## Configuration

### Thresholds (configurable in `/src/lib/queryOptimizer.ts`)
```javascript
const OPTIMIZATION_THRESHOLD = 500; // Sessions count to trigger optimization
const MAX_UNPAID_SESSIONS_LIMIT = 1000; // Safety limit for unpaid sessions
const QUERY_TIMEOUT = 30000; // 30 seconds timeout for queries
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
```

## Monitoring & Debugging

### Console Logs
- `📊 Dataset analysis: X sessions, optimization enabled/disabled`
- `🔧 Using optimized query pattern for large dataset`
- `📊 Query Performance [optimized]: X ms for Y sessions`
- `⚠️ Very large dataset detected: X sessions. Consider additional optimization`

### Performance Metrics
Access via browser console:
```javascript
// Get performance summary for all tutors
datasetMonitor.getPerformanceSummary()
```

## Future Recommendations

### For Datasets >10,000 Sessions
- Consider implementing pagination
- Archive sessions older than 2 years
- Implement virtual scrolling for large lists

### For Datasets >5,000 Sessions
- The system will automatically suggest archiving old data
- Monitor performance metrics in console logs

## Testing

To test with a new large dataset:
1. Create a tutor with 500+ sessions
2. System automatically detects and switches to optimized queries
3. Monitor console logs for performance metrics
4. Verify all components show consistent data

## Backwards Compatibility

- Existing accounts with < 500 sessions continue using standard queries
- No performance impact for small accounts
- Zero configuration required for optimization to activate

## Technical Implementation

The system uses three main components:

1. **Query Optimizer** (`/src/lib/queryOptimizer.ts`)
   - Automatic detection and query selection
   - Caching and error handling

2. **Dataset Monitor** (`/src/lib/datasetMonitor.ts`)
   - Performance tracking and alerting
   - Archiving recommendations

3. **Dashboard Optimizer** (`/src/lib/dashboardOptimizer.ts`)
   - Specialized optimization for dashboard statistics

This ensures any future tutor with extensive session data will automatically receive optimized performance without any manual configuration or code changes.

---

## Admin Dashboard: SQL Aggregation System

### Overview

The Admin Dashboard uses a separate, more scalable approach using PostgreSQL RPC functions for server-side aggregation. This enables the admin dashboard to handle millions of sessions instantly.

### How It Works

Instead of fetching all sessions and counting them in JavaScript:
```javascript
// Old approach (slow, limited)
const sessions = await fetchAll('sessions'); // 30,000 max
const count = sessions.length;
```

The system uses SQL to do the counting:
```sql
-- New approach (instant, unlimited)
SELECT COUNT(*) FROM sessions WHERE ...
```

### RPC Functions

Six PostgreSQL functions handle all admin metrics:

| Function | Purpose | Returns |
|----------|---------|---------|
| `get_active_students_count(days)` | Unique students with sessions | Integer |
| `get_earnings_by_tutor(paid_only)` | Earnings per tutor/currency | Table |
| `get_top_tutors_earnings(limit)` | Top earners with aggregates | Table |
| `get_active_tutors_count(days)` | Active tutors in period | Integer |
| `get_unpaid_sessions_count()` | Unpaid completed sessions | Integer |
| `get_sessions_count_in_range(start, end)` | Sessions in date range | Integer |

### Installation

Run the SQL in `create-admin-aggregate-functions.sql` via Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Paste contents of `create-admin-aggregate-functions.sql`
4. Click "Run"

### Fallback Behavior

If RPC functions are not installed:
- System automatically uses paginated batch fetching
- Limited to 30,000 sessions maximum
- Console shows: `(RPC: false)`

When RPC is active:
- Unlimited scalability
- Console shows: `(RPC: true)`

### Performance Comparison

| Metric | Fallback Mode | RPC Mode | Improvement |
|--------|---------------|----------|-------------|
| Admin Metrics | ~3,500ms | ~1,400ms | 2.5x faster |
| Top Tutors | ~3,000ms | ~236ms | 12x faster |
| Scalability | 30k sessions | Unlimited | ∞ |

### Monitoring

Console logs indicate the mode:
```
📊 Admin Metrics: Completed in 1406ms (RPC: true)
📊 Top Tutors: Completed via RPC in 236ms
```

Or in fallback mode:
```
📊 Admin Metrics: RPC functions not available, using fallback...
📊 Admin Metrics: Completed in 3461ms (RPC: false)
```

### Week Calculation

Both admin dashboard and individual tutor dashboards use **Monday as the start of week** for consistent metrics across the platform.