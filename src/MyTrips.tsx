import { useState, useEffect } from "react";
import { supabase } from "./client";
import { useAuth } from "./AuthContext";

interface Trip {
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

const MyTrips = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchTrips();
    } else {
      // In guest mode, no persisted trips; stop loading
      setLoading(false);
    }
  }, [user]);

  const fetchTrips = async () => {
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
        .gt("rides.departure_time", new Date().toISOString())
        .order("rides(departure_time)", { ascending: true });

      if (error) throw error;
      setTrips(data || []);
    } catch (error) {
      console.error("Error fetching trips:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading trips...</div>;
  }

  return (
    <div className="space-y-4">
      {(!user || trips.length === 0) ? (
        <div className="text-center py-10 px-6 bg-white rounded-lg shadow-md">
          <p className="text-gray-500">
            {user
              ? "You have no upcoming trips."
              : "Guests don’t have a saved trips list. Approved trips are visible when using an account."}
          </p>
        </div>
      ) : (
        trips.map((trip) => (
          <div key={trip.id} className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">
                  {trip.rides.origin} → {trip.rides.destination}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Driver: {trip.rides.profiles.full_name}
                </p>
                <p className="text-sm text-gray-600">
                  {trip.seats_requested} seat(s) booked
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {new Date(trip.rides.departure_time).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-600">
                  {new Date(trip.rides.departure_time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default MyTrips;
