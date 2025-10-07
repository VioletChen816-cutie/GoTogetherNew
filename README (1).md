# GoTogether - Campus Ridesharing Platform

Your friendly ridesharing community for campus travel. Built with React, TypeScript, and Lovable Cloud.

## Features

### For Passengers
- **Find Rides**: Browse available rides with real-time seat availability
- **Request Booking**: Request seats on rides and track request status
- **My Trips**: View confirmed upcoming trips
- **Ride History**: Review past trips

### For Drivers
- **Post Trips**: Create ride postings with automatic cost calculations
- **Manage Requests**: Approve or deny passenger booking requests
- **Dashboard**: View all posted rides and pending requests with real-time updates

### Core Features
- **Authentication**: Secure signup/login with email
- **Real-time Updates**: Instant notifications when requests are approved or seats change
- **Role Switching**: Seamlessly switch between passenger and driver views
- **Cost Calculation**: Automatic fuel cost estimation per passenger

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Lovable Cloud (Supabase)
- **Database**: PostgreSQL with Row-Level Security
- **Real-time**: Supabase Realtime for instant updates
- **Authentication**: Supabase Auth

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Visit `http://localhost:8080`

## Database Schema

- **profiles**: User information (name, role, ratings, phone)
- **rides**: Trip details posted by drivers
- **requests**: Passenger booking requests with approval workflow

## Security

- Row-Level Security (RLS) policies ensure users can only access their own data
- Drivers can only manage their own rides
- Passengers can only see their own requests
- All data is encrypted and securely stored

## Future Enhancements

- Integration with mapping APIs (Google Maps/Mapbox) for accurate routes
- Email/SMS notifications for booking confirmations
- User ratings and reviews system
- Profile pictures and user verification
- Payment processing integration
