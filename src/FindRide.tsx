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
  driver_id: string | null;
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
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [originFilter, setOriginFilter] = useState<string>("All Locations");
  const [destinationFilter, setDestinationFilter] = useState<string>("All Locations");
  const [origins, setOrigins] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<string[]>([]);

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
      const list = data || [];
      setRides(list);
      // Build unique origin/destination lists
      const originSet = new Set<string>();
      const destinationSet = new Set<string>();
      list.forEach((r) => {
        if (r.origin) originSet.add(r.origin);
        if (r.destination) destinationSet.add(r.destination);
      });
      setOrigins(["All Locations", ...Array.from(originSet)]);
      setDestinations(["All Locations", ...Array.from(destinationSet)]);
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

  const generateTempPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
    let pwd = "";
    for (let i = 0; i < 14; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  };

  const handleBooking = async () => {
    if (!selectedRide) return;
    
    if (!user) {
      // Guest flow: insert directly without auth using contact info
      if (!guestEmail) {
        toast({
          title: "Email required",
          description: "Please enter your email to continue.",
          variant: "destructive",
        });
        return;
      }

      try {
        const { error } = await supabase
          .from("requests")
          // Cast to any to bypass TS types generated from the old schema
          .insert({
            ride_id: selectedRide.id,
            passenger_id: null,
            seats_requested: seatsToBook,
            contact_email: guestEmail,
            contact_name: guestName || null,
          } as any);

        if (error) throw error;

        toast({
          title: "Request sent!",
          description: "Your booking request has been sent to the driver.",
        });
        setSelectedRide(null);
        setSeatsToBook(1);
        setGuestEmail("");
        setGuestName("");
        return;
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
        return;
      }
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
    // Allow guests to request; dialog will collect contact info
    setSelectedRide(ride);
  };

  if (loading) {
    return <div className="text-center py-10">Loading rides...</div>;
  }

  return (
    <>
      {/* Filters bar */}
      <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label className="text-gray-700">From</Label>
            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                {origins.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-700">To</Label>
            <Select value={destinationFilter} onValueChange={setDestinationFilter}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end md:justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setOriginFilter("All Locations");
                setDestinationFilter("All Locations");
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {rides.length === 0 ? (
          <div className="text-center py-10 px-6 bg-white rounded-lg shadow-md">
            <p className="text-gray-500">No rides available at the moment.</p>
          </div>
        ) : (
          rides
            .filter((ride) =>
              (originFilter === "All Locations" || ride.origin === originFilter) &&
              (destinationFilter === "All Locations" || ride.destination === destinationFilter)
            )
            .map((ride) => {
            const departureDate = new Date(ride.departure_time);
            const arrivalDate = new Date(ride.arrival_time);
            const seatsText = `${ride.available_seats} of ${ride.total_seats} seats left`;

            return (
              <div
                key={ride.id}
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold">
                      {ride.origin} → {ride.destination}
                    </h3>
                    <p className="text-sm text-gray-500 mt-2">{seatsText}</p>
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
                  <span className="text-lg font-bold text-green-600">~${ride.cost_per_person.toFixed(2)} / person</span>
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
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {!user && (
              <>
                <Label htmlFor="guestName">Your name</Label>
                <Input
                  id="guestName"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g., Alex"
                  className="mt-2 mb-4"
                />
                <Label htmlFor="guestEmail">Contact email</Label>
                <Input
                  id="guestEmail"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-2 mb-4"
                  required
                />
              </>
            )}
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
