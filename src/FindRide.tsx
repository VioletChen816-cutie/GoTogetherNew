import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./client";
import { useAuth } from "./AuthContext";
import { Button } from "./components/button";
import { useToast } from "./components/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./components/dialog";
import { Input } from "./components/input";
import { Label } from "./components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/card";

interface Ride {
  id: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  total_seats: number;
  available_seats: number;
  cost_per_person: number;
  driver_id: string;
  profiles: {
    full_name: string;
    rating: number;
    total_ratings: number;
  };
}

const FindRide = () => {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [seatsToBook, setSeatsToBook] = useState(1);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRides();
    
    // Set up realtime subscription
    const channel = supabase
      .channel("rides-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rides",
        },
        () => {
          fetchRides();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRides = async () => {
    try {
      const { data, error } = await supabase
        .from("rides")
        .select(`
          *,
          profiles:driver_id (
            full_name,
            rating,
            total_ratings
          )
        `)
        .gt("departure_time", new Date().toISOString())
        .gt("available_seats", 0)
        .order("departure_time", { ascending: true });

      if (error) throw error;
      setRides(data || []);
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

  const handleBooking = async () => {
    if (!selectedRide) return;
    
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to request a ride.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    try {
      const { error } = await supabase.from("requests").insert({
        ride_id: selectedRide.id,
        passenger_id: user.id,
        seats_requested: seatsToBook,
      });

      if (error) throw error;

      toast({
        title: "Request sent!",
        description: "Your booking request has been sent to the driver.",
      });
      setSelectedRide(null);
      setSeatsToBook(1);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRequestClick = (ride: Ride) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to request a ride.",
      });
      navigate("/auth");
      return;
    }
    setSelectedRide(ride);
  };

  if (loading) {
    return <div className="text-center py-10">Loading rides...</div>;
  }

  return (
    <>
      <div className="space-y-4">
        {rides.length === 0 ? (
          <div className="text-center py-10 px-6 bg-white rounded-lg shadow-md">
            <p className="text-gray-500">No rides available at the moment.</p>
          </div>
        ) : (
          rides.map((ride) => {
            const departureDate = new Date(ride.departure_time);
            const arrivalDate = new Date(ride.arrival_time);
            const avgRating = ride.profiles.total_ratings > 0
              ? (ride.profiles.rating / ride.profiles.total_ratings).toFixed(1)
              : "New";

            return (
              <div
                key={ride.id}
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold">
                      {ride.origin} → {ride.destination}
                    </h3>
                    <p className="text-sm text-gray-500 mt-2">
                      Driver: {ride.profiles.full_name} ⭐ {avgRating}
                    </p>
                    <p className="text-sm text-gray-500">
                      {ride.available_seats} of {ride.total_seats} seats left
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <div className="text-lg font-semibold">
                      {departureDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="text-sm text-gray-500">
                      {departureDate.toLocaleDateString([], { month: "short", day: "numeric" })}
                    </div>
                    <div className="text-sm text-gray-500">
                      Arrival: {arrivalDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <span className="text-lg font-bold text-green-600">
                    ${ride.cost_per_person.toFixed(2)} / person
                  </span>
                  <Button onClick={() => handleRequestClick(ride)}>Request</Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={!!selectedRide} onOpenChange={() => setSelectedRide(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request to Book</DialogTitle>
            <DialogDescription>
              {selectedRide && (
                <>
                  <p className="mt-2">
                    {selectedRide.origin} → {selectedRide.destination}
                  </p>
                  <p className="mt-2 text-sm text-gray-600">
                    Driver: {selectedRide.profiles.full_name}
                  </p>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="seats">How many seats?</Label>
            <Input
              id="seats"
              type="number"
              min="1"
              max={selectedRide?.available_seats}
              value={seatsToBook}
              onChange={(e) => setSeatsToBook(parseInt(e.target.value))}
              className="mt-2"
            />
          </div>
          <div className="flex gap-4">
            <Button onClick={handleBooking} className="flex-1">
              Send Request
            </Button>
            <Button variant="outline" onClick={() => setSelectedRide(null)} className="flex-1">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FindRide;
