# TutorTrack - Tutoring Management System

A comprehensive, timezone-friendly tutoring management platform built with React and Supabase. Features an advanced scheduling tool with FullCalendar integration, intelligent dataset optimization for scalability, and complete timezone awareness for global tutoring operations.

## 🚀 Features

### Core Functionality
- **Advanced Scheduling Tool**: Full-featured calendar with FullCalendar integration, drag-and-drop functionality, and multi-view support (month, week, day, agenda)
- **Timezone-Friendly Architecture**: Complete timezone awareness with automatic detection, manual override, and proper UTC storage with local display
- **Intelligent Dataset Optimization**: Automatic query optimization that switches strategies based on dataset size for optimal performance
- **Student Management**: Add, edit, and organize students with tags, contact information, and profile pictures
- **Earnings Tracking**: Real-time earnings calculations with detailed breakdowns by time periods
- **Public Booking**: Student-facing booking page with timezone-aware slot selection
- **Pending Requests**: Manage booking requests from students with approval workflow

### Recent Updates (June 2025)

#### UTC Timestamp Migration ✅
- **Complete migration** from legacy date/time fields to UTC timestamp-based session management
- All sessions now use `session_start` and `session_end` fields exclusively
- Timezone-aware display while maintaining UTC storage for data consistency
- Enhanced booking flow with proper timezone conversion

#### Booking System Fixes ✅
- **Fixed student booking page** with proper timezone conversion from tutor's timezone to student's local timezone
- **Resolved pending requests modal** to work with new UTC timestamp schema
- **Enhanced booking submission** with correct field validation and error handling
- **Improved slot availability** filtering to exclude cancelled sessions

#### Calendar Enhancements ✅
- **Restored calendar slot selection** functionality with animated loading indicators
- **Fixed ghost session cards** issue preventing proper session creation
- **Added session card hover animations** for better user experience
- **Enhanced timezone handling** with fallback mechanisms for Asia/Shanghai timezone

#### Advanced Scheduling Tool ✅
- **FullCalendar integration** with multiple view modes (month, week, day, agenda)
- **Drag-and-drop scheduling** for intuitive session management
- **Mobile-responsive** calendar views optimized for all devices
- **Real-time session updates** with live synchronization across components

#### Timezone-Friendly System ✅
- **Complete timezone awareness** throughout the entire application
- **Automatic timezone detection** with manual override capabilities
- **UTC storage with local display** ensuring data consistency across timezones
- **DST handling** via Luxon for accurate time calculations
- **Multi-timezone support** for tutors and students in different regions

#### Dataset Optimization ✅
- **Intelligent query optimization** that automatically switches strategies based on dataset size (500+ sessions threshold)
- **Performance monitoring** with query execution time tracking and alerts
- **Scalable architecture** supporting both small and large tutoring operations
- **Row Level Security (RLS)** policies for secure data access
- **Real-time subscriptions** for live data updates across components

## 🛠 Technology Stack

**Frontend**
- React 18 with TypeScript
- Vite for development and building
- Tailwind CSS for styling
- Radix UI for accessible components
- TanStack Query for server state management
- FullCalendar for scheduling interface
- Luxon for timezone handling

**Backend**
- Express.js server
- Supabase (PostgreSQL) for database
- Supabase Auth for authentication
- Supabase Storage for file uploads

**Key Libraries**
- React Hook Form with Zod validation
- Wouter for client-side routing
- Canvas Confetti for success animations
- React Beautiful DnD for dashboard customization

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tutortrack
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file with your Supabase credentials:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

## 🗄 Database Schema

### Core Tables
- **tutors**: User profiles linked to Supabase Auth
- **students**: Student records with contact info and metadata
- **sessions**: Tutoring sessions with UTC timestamps (`session_start`, `session_end`)
- **booking_slots**: Available time slots for public booking
- **payments**: Payment tracking for completed sessions

### Recent Schema Updates
- **Deprecated fields**: `date` and `time` columns removed in favor of UTC timestamps
- **New fields**: `session_start` and `session_end` for precise timezone handling
- **Enhanced validation**: Proper decimal handling for rates and improved status enums

## 🌍 Timezone Handling

The application implements comprehensive timezone support:

1. **Storage**: All session times stored as UTC timestamps
2. **Display**: Times converted to user's timezone for display
3. **Booking**: Students see times in their local timezone
4. **Conversion**: Automatic timezone detection with manual override options

### Timezone Features
- Browser-based timezone detection
- Manual timezone selection with search
- Proper DST handling via Luxon
- Fallback mechanisms for timezone resolution

## 🔧 Performance Features

### Dataset Optimization
- **Automatic detection**: Switches to optimized queries for datasets over 500 sessions
- **Query strategies**: JOINs for small datasets, separate fetches for large datasets
- **Monitoring**: Execution time tracking with performance alerts

### Caching Strategy
- React Query for intelligent server state caching
- Optimistic updates for better user experience
- Cache invalidation on mutations

## 🚀 Deployment

The application is configured for Replit deployment:

1. **Development**: Vite dev server with Express middleware
2. **Production**: Static build served by Express with client-side routing
3. **Environment**: Node.js 20 with PostgreSQL integration

## 📱 Public Booking Flow

Students can book sessions through a public booking page:

1. **Access**: Visit `/booking/[tutorId]` for tutor-specific booking
2. **Timezone**: Automatic detection with manual override
3. **Slots**: View available time slots in local timezone
4. **Submission**: Book sessions with proper UTC conversion
5. **Confirmation**: Booking requests appear in tutor's pending requests

## 🔐 Security

- **Row Level Security**: Database-level access control
- **Authentication**: Supabase Auth integration
- **File uploads**: Secure avatar storage with access policies
- **Validation**: Client and server-side data validation

## 🐛 Recent Bug Fixes

### June 2025 Fixes
- ✅ **Booking submission errors**: Fixed field validation and decimal formatting
- ✅ **Pending requests display**: Updated to work with UTC timestamp schema
- ✅ **Calendar slot selection**: Restored functionality with loading animations
- ✅ **Timezone conversion**: Enhanced student booking with proper time display
- ✅ **Session card rendering**: Fixed ghost cards and added hover effects

## 📝 Usage

### For Tutors
1. **Sign up/Login**: Create account and complete profile setup
2. **Add Students**: Manage student roster with contact information
3. **Create Availability**: Set up available time slots for booking
4. **Schedule Sessions**: Use calendar to schedule and manage sessions
5. **Handle Requests**: Review and approve student booking requests
6. **Track Earnings**: Monitor income with detailed analytics

### For Students
1. **Access Booking Page**: Visit tutor's public booking URL
2. **Select Timezone**: Confirm or change timezone preference
3. **Choose Slot**: Pick from available time slots
4. **Submit Request**: Provide name and submit booking request
5. **Wait for Confirmation**: Tutor will review and confirm booking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following existing patterns
4. Test thoroughly
5. Submit pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues or questions:
1. Check existing documentation
2. Review recent updates in changelog
3. Submit detailed bug reports with timezone information
4. Include browser and device details for booking issues