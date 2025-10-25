import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./client";
import { useAuth } from "./AuthContext";
import { Button } from "./components/button";
import { useToast } from "./components/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/tabs";
import FindRide from "./FindRide";
import MyRequests from "./MyRequests";
import MyTrips from "./MyTrips";
import RideHistory from "./RideHistory";
import DriverDashboard from "./DriverDashboard";
import OfferRide from "./OfferRide";
import { LogOut, User as UserIcon } from "lucide-react";

const Dashboard = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [currentRole, setCurrentRole] = useState<"passenger" | "driver">("passenger");
  const { toast } = useToast();

  useEffect(() => {
    // Default to guest passenger view; sync role when profile available
    if (profile) setCurrentRole(profile.role);
  }, [user, profile, loading, navigate]);

  // After sign-in, auto-complete any pending guest actions
  useEffect(() => {
    const processPending = async () => {
      if (!user) return;

      // Pending posting
      const postingRaw = localStorage.getItem("pendingPosting");
      if (postingRaw) {
        try {
          const posting = JSON.parse(postingRaw);
          const { error } = await supabase.from("rides").insert({
            driver_id: user.id,
            ...posting,
          });
          if (error) throw error;
          localStorage.removeItem("pendingPosting");
          toast({ title: "Trip posted", description: "Your trip has been posted." });
        } catch (err: any) {
          toast({ title: "Failed to post trip", description: err.message, variant: "destructive" });
        }
      }

      // Pending booking
      const bookingRaw = localStorage.getItem("pendingBooking");
      if (bookingRaw) {
        try {
          const booking = JSON.parse(bookingRaw);
          const { error } = await supabase.from("requests").insert({
            passenger_id: user.id,
            ...booking,
          });
          if (error) throw error;
          localStorage.removeItem("pendingBooking");
          toast({ title: "Request sent", description: "Your booking request has been sent." });
        } catch (err: any) {
          toast({ title: "Failed to send request", description: err.message, variant: "destructive" });
        }
      }
    };

    processPending();
  }, [user]);

  // Sign-in/out removed; guests can fully use posting/requesting flows

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Remove the profile check to allow guest access

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto max-w-4xl p-4">
        {/* Header */}
        <header className="text-center my-8">
          <h1 className="text-4xl font-bold text-gray-800">GoTogether</h1>
          <p className="text-gray-500 mt-2">Your friendly ridesharing community</p>
          
          {/* Auth UI removed: site runs fully in guest mode */}

          {/* Role toggle: available to guests and authenticated users */}
          <div className="mt-4">
            <span className="text-sm font-medium text-gray-900 mr-3">Viewing as:</span>
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => setCurrentRole("passenger")}
                className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
                  currentRole === "passenger"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-900 border-gray-200 hover:bg-gray-100"
                }`}
              >
                Passenger
              </button>
              <button
                type="button"
                onClick={() => setCurrentRole("driver")}
                className={`px-4 py-2 text-sm font-medium rounded-r-lg border ${
                  currentRole === "driver"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-900 border-gray-200 hover:bg-gray-100"
                }`}
              >
                Driver
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main>
          {currentRole === "passenger" ? (
            <Tabs defaultValue="find" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="find">Find a Ride</TabsTrigger>
                <TabsTrigger value="requests">My Requests</TabsTrigger>
                <TabsTrigger value="trips">My Trips</TabsTrigger>
                <TabsTrigger value="history">Ride History</TabsTrigger>
              </TabsList>
              <TabsContent value="find">
                <FindRide />
              </TabsContent>
              <TabsContent value="requests">
                <MyRequests />
              </TabsContent>
              <TabsContent value="trips">
                <MyTrips />
              </TabsContent>
              <TabsContent value="history">
                <RideHistory />
              </TabsContent>
            </Tabs>
          ) : (
            // Driver view: expose OfferRide to guests; gate actions inside
            <Tabs defaultValue={user ? "dashboard" : "offer"} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="dashboard">My Postings</TabsTrigger>
                <TabsTrigger value="offer">Offer a Ride</TabsTrigger>
              </TabsList>
              <TabsContent value="dashboard">
                {user ? (
                  <DriverDashboard />
                ) : (
                  <div className="text-center py-10 px-6 bg-white rounded-lg shadow-md">
                    <p className="text-gray-600">Sign in to view and manage your postings.</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="offer">
                <OfferRide />
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
