import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./client";
import { useAuth } from "./AuthContext";
import { Button } from "./components/button";
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

  useEffect(() => {
    // Allow guests to view content, only redirect if explicitly needed
    if (profile) {
      setCurrentRole(profile.role);
    }
  }, [user, profile, loading, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

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
          
          <div className="mt-4 flex items-center justify-center gap-4">
            {user && profile ? (
              <>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <UserIcon className="h-4 w-4" />
                  <span>{profile.full_name}</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <div className="text-sm text-gray-600">
                  Browsing as guest
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/auth")}>
                  <UserIcon className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              </>
            )}
          </div>

          {/* Role Display - only show for authenticated users */}
          {user && profile && (
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
          )}
        </header>

        {/* Main Content */}
        <main>
          {user && profile ? (
            // Authenticated user content
            currentRole === "passenger" ? (
              <Tabs defaultValue="find" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  <TabsTrigger value="find">Find a Ride</TabsTrigger>
                  <TabsTrigger value="requests">My Requests</TabsTrigger>
                  <TabsTrigger value="trips">My Trips</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
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
              <Tabs defaultValue="dashboard" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="dashboard">My Postings</TabsTrigger>
                  <TabsTrigger value="offer">Offer a Ride</TabsTrigger>
                </TabsList>
                <TabsContent value="dashboard">
                  <DriverDashboard />
                </TabsContent>
                <TabsContent value="offer">
                  <OfferRide />
                </TabsContent>
              </Tabs>
            )
          ) : (
            // Guest content - only show available rides
            <div className="w-full">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-center mb-2">Available Rides</h2>
                <p className="text-center text-gray-600 mb-4">
                  Browse available rides. Sign in to request a ride or offer your own.
                </p>
              </div>
              <FindRide />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
