import { useState, useEffect } from "react";
import { supabase } from "./client";
import { useAuth } from "./AuthContext";

interface HistoryTrip {
  id: string;
  seats_requested: number;
  rides: {
    origin: string;
    destination: string;
    departure_time: string;
    profiles: {
      full_name: string;
    };
  };
}

const RideHistory = () => {
  const [history, setHistory] = useState<HistoryTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("requests")
        .select(`
          *,
          rides (
            origin,
            destination,
            departure_time,
            profiles:driver_id (
              full_name
            )
          )
        `)
        .eq("passenger_id", user.id)
        .eq("status", "approved")
        .lt("rides.departure_time", new Date().toISOString())
        .order("rides(departure_time)", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading history...</div>;
  }

  return (
    <div className="space-y-4">
      {history.length === 0 ? (
        <div className="text-center py-10 px-6 bg-white rounded-lg shadow-md">
          <p className="text-gray-500">You have no past trips.</p>
        </div>
      ) : (
        history.map((trip) => (
          <div key={trip.id} className="bg-white p-6 rounded-xl shadow-md opacity-70">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">
                  {trip.rides.origin} → {trip.rides.destination}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Driver: {trip.rides.profiles.full_name}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {new Date(trip.rides.departure_time).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default RideHistory;
