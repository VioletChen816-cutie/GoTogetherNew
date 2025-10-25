import { useState, useEffect } from "react";
import { supabase } from "./client";
import { useAuth } from "./AuthContext";
import { Button } from "./components/button";
import { useToast } from "./components/use-toast";

interface Ride {
  id: string;
  origin: string;
  destination: string;
  departure_time: string;
  total_seats: number;
  available_seats: number;
  cost_per_person: number;
  // If a ride was created by a guest, driver_id can be null
  driver_id?: string | null;
}

interface Request {
  id: string;
  seats_requested: number;
  status: string;
  profiles: {
    full_name: string;
  };
  contact_email?: string | null;
  contact_name?: string | null;
}

const DriverDashboard = () => {
  const [rides, setRides] = useState<Ride[]>([]);
  const [requestsByRide, setRequestsByRide] = useState<Record<string, Request[]>>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchData();
      
      // Set up realtime subscriptions
      const ridesChannel = supabase
        .channel("driver-rides")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "rides",
            filter: `driver_id=eq.${user.id}`,
          },
          () => {
            fetchData();
          }
        )
        .subscribe();

      const requestsChannel = supabase
        .channel("driver-requests")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "requests",
          },
          () => {
            fetchData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(ridesChannel);
        supabase.removeChannel(requestsChannel);
      };
    } else {
      // In guest mode, no driver management data; stop loading
      setLoading(false);
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch rides
      const { data: ridesData, error: ridesError } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user.id)
        .gt("departure_time", new Date().toISOString())
        .order("departure_time", { ascending: true });

      if (ridesError) throw ridesError;
      setRides(ridesData || []);

      // Fetch all requests for these rides
      if (ridesData && ridesData.length > 0) {
        const rideIds = ridesData.map((r) => r.id);
        const { data: requestsData, error: requestsError } = await supabase
          .from("requests")
          .select(`
            *,
            profiles:passenger_id (
              full_name
            )
          `)
          .in("ride_id", rideIds);

        if (requestsError) throw requestsError;

        // Group requests by ride
        const grouped: Record<string, Request[]> = {};
        requestsData?.forEach((req) => {
          if (!grouped[req.ride_id]) {
            grouped[req.ride_id] = [];
          }
          grouped[req.ride_id].push(req);
        });
        setRequestsByRide(grouped);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestDecision = async (requestId: string, rideId: string, decision: "approve" | "deny") => {
    try {
      const request = Object.values(requestsByRide)
        .flat()
        .find((r) => r.id === requestId);
      const ride = rides.find((r) => r.id === rideId);

      if (!request || !ride) return;

      if (decision === "approve") {
        if (ride.available_seats >= request.seats_requested) {
          // Update request status
          const { error: requestError } = await supabase
            .from("requests")
            .update({ status: "approved" })
            .eq("id", requestId);

          if (requestError) throw requestError;

          // Update available seats
          const { error: rideError } = await supabase
            .from("rides")
            .update({ available_seats: ride.available_seats - request.seats_requested })
            .eq("id", rideId);

          if (rideError) throw rideError;

          toast({
            title: "Request approved!",
            description: `${request.profiles.full_name}'s request has been approved.`,
          });
        } else {
          // Not enough seats, deny
          await supabase
            .from("requests")
            .update({ status: "denied" })
            .eq("id", requestId);

          toast({
            title: "Not enough seats",
            description: "Request denied due to insufficient seats.",
            variant: "destructive",
          });
        }
      } else {
        // Deny
        const { error } = await supabase
          .from("requests")
          .update({ status: "denied" })
          .eq("id", requestId);

        if (error) throw error;

        toast({
          title: "Request denied",
          description: `${request.profiles.full_name}'s request has been denied.`,
        });
      }

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {(!user || rides.length === 0) ? (
        <div className="text-center py-10 px-6 bg-white rounded-lg shadow-md">
          <p className="text-gray-500">
            {user
              ? "You have not posted any rides."
              : "Driver management isn’t available in guest mode. You can still post trips from the Offer a Trip tab."}
          </p>
        </div>
      ) : (
        rides.map((ride) => {
          const requests = requestsByRide[ride.id] || [];
          const pendingRequests = requests.filter((r) => r.status === "pending");
          const approvedPassengers = requests
            .filter((r) => r.status === "approved")
            .map((r) => r.profiles.full_name)
            .join(", ");

          return (
            <div key={ride.id} className="bg-white p-4 rounded-xl shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold">
                    {ride.origin} → {ride.destination}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {ride.available_seats} of {ride.total_seats} seats remaining
                  </p>
                  <p className="text-sm text-gray-500">
                    Current cost: ${ride.cost_per_person.toFixed(2)}/person
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Passengers: {approvedPassengers || "None yet"}
                  </p>
                </div>
                <span className="font-semibold text-blue-600">
                  {pendingRequests.length} Pending Request(s)
                </span>
              </div>
              <div className="request-list mt-4 border-t pt-4 space-y-3">
                {pendingRequests.length > 0 ? (
                  pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="bg-gray-50 p-3 rounded-lg flex justify-between items-center"
                    >
                      <div>
                        <p>
                          {(req.profiles?.full_name || req.contact_name || "Guest")} requested <strong>{req.seats_requested}</strong> seat(s)
                        </p>
                        {(!req.profiles?.full_name && req.contact_email) && (
                          <p className="text-xs text-gray-500">Contact: {req.contact_email}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleRequestDecision(req.id, ride.id, "approve")}
                          className="bg-green-500 hover:bg-green-600"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRequestDecision(req.id, ride.id, "deny")}
                        >
                          Deny
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400 text-center">No pending requests.</p>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default DriverDashboard;
