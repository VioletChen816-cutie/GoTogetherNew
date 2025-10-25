import { useState, useEffect } from "react";
import { supabase } from "./client";
import { useAuth } from "./AuthContext";
import { Badge } from "./components/badge";

interface Request {
  id: string;
  seats_requested: number;
  status: "pending" | "approved" | "denied";
  rides: {
    origin: string;
    destination: string;
    departure_time: string;
  };
}

const MyRequests = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchRequests();
      
      // Set up realtime subscription
      const channel = supabase
        .channel("requests-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "requests",
            filter: `passenger_id=eq.${user.id}`,
          },
          () => {
            fetchRequests();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      // In guest mode, nothing to fetch; avoid hanging loaders
      setLoading(false);
    }
  }, [user]);

  const fetchRequests = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("requests")
        .select(`
          *,
          rides (
            origin,
            destination,
            departure_time
          )
        `)
        .eq("passenger_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading requests...</div>;
  }

  return (
    <div className="space-y-4">
      {(!user || requests.length === 0) ? (
        <div className="text-center py-10 px-6 bg-white rounded-lg shadow-md">
          <p className="text-gray-500">
            {user
              ? "You have not requested any rides."
              : "Guests don’t have a saved requests list. Your requests are sent to drivers using your contact details."}
          </p>
        </div>
      ) : (
        requests.map((request) => {
          const statusColors = {
            pending: "bg-yellow-100 text-yellow-800",
            approved: "bg-green-100 text-green-800",
            denied: "bg-red-100 text-red-800",
          };

          return (
            <div key={request.id} className="bg-white p-4 rounded-xl shadow-md">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold">
                    {request.rides.origin} → {request.rides.destination}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Requested {request.seats_requested} seat(s)
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(request.rides.departure_time).toLocaleString()}
                  </p>
                </div>
                <Badge className={statusColors[request.status]}>
                  {request.status}
                </Badge>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default MyRequests;
