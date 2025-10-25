import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./client";
import { useAuth } from "./AuthContext";
import { Button } from "./components/button";
import { Input } from "./components/input";
import { Label } from "./components/label";
import { useToast } from "./components/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "./components/card";

const OfferRide = () => {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [datetime, setDatetime] = useState("");
  const [seats, setSeats] = useState("");
  const [estArrivalTime, setEstArrivalTime] = useState("");
  const [estFuelCost, setEstFuelCost] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    calculateEstimates();
  }, [origin, destination, datetime, seats]);

  const calculateEstimates = () => {
    if (!origin || !destination || !datetime || !seats) return;

    // Mock calculation (in real app, use mapping API)
    const mockDistance = (origin.length + destination.length) * 12; // miles
    const mockDurationMinutes = Math.round((mockDistance / 55) * 60); // at 55 mph
    const AVG_MPG = 25;
    const PRICE_PER_GALLON = 3.85;

    const totalFuelCost = (mockDistance / AVG_MPG) * PRICE_PER_GALLON;
    const seatsNum = parseInt(seats);
    const costPerPerson = totalFuelCost / (seatsNum + 1); // +1 for driver

    const departureDate = new Date(datetime);
    const arrivalDate = new Date(departureDate.getTime() + mockDurationMinutes * 60000);

    setEstArrivalTime(arrivalDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    setEstFuelCost(`~$${costPerPerson.toFixed(2)}`);
  };

  const generateTempPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
    let pwd = "";
    for (let i = 0; i < 14; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        const seatsNum = parseInt(seats);
        const departureDate = new Date(datetime);

        // Calculate arrival time and cost
        const mockDistance = (origin.length + destination.length) * 12;
        const mockDurationMinutes = Math.round((mockDistance / 55) * 60);
        const arrivalDate = new Date(departureDate.getTime() + mockDurationMinutes * 60000);

        const AVG_MPG = 25;
        const PRICE_PER_GALLON = 3.85;
        const totalFuelCost = (mockDistance / AVG_MPG) * PRICE_PER_GALLON;
        const costPerPerson = totalFuelCost / (seatsNum + 1);

        const { error } = await supabase
          .from("rides")
          // Cast to any to bypass TS types generated from the old schema
          .insert({
            driver_id: null,
            origin,
            destination,
            departure_time: departureDate.toISOString(),
            arrival_time: arrivalDate.toISOString(),
            total_seats: seatsNum,
            available_seats: seatsNum,
            cost_per_person: costPerPerson,
            contact_email: guestEmail,
            contact_name: guestName || null,
          } as any);

        if (error) throw error;

        toast({ title: "Trip posted!", description: "Your trip has been posted successfully." });

        // Reset form
        setOrigin("");
        setDestination("");
        setDatetime("");
        setSeats("");
        setEstArrivalTime("");
        setEstFuelCost("");
        setGuestEmail("");
        setGuestName("");
        return;
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
        return;
      }
    }

    setLoading(true);
    try {
      const seatsNum = parseInt(seats);
      const departureDate = new Date(datetime);
      
      // Calculate arrival time and cost
      const mockDistance = (origin.length + destination.length) * 12;
      const mockDurationMinutes = Math.round((mockDistance / 55) * 60);
      const arrivalDate = new Date(departureDate.getTime() + mockDurationMinutes * 60000);
      
      const AVG_MPG = 25;
      const PRICE_PER_GALLON = 3.85;
      const totalFuelCost = (mockDistance / AVG_MPG) * PRICE_PER_GALLON;
      const costPerPerson = totalFuelCost / (seatsNum + 1);

      const { error } = await supabase.from("rides").insert({
        driver_id: user.id,
        origin,
        destination,
        departure_time: departureDate.toISOString(),
        arrival_time: arrivalDate.toISOString(),
        total_seats: seatsNum,
        available_seats: seatsNum,
        cost_per_person: costPerPerson,
      });

      if (error) throw error;

      toast({
        title: "Trip posted!",
        description: "Your trip has been posted successfully.",
      });

      // Reset form
      setOrigin("");
      setDestination("");
      setDatetime("");
      setSeats("");
      setEstArrivalTime("");
      setEstFuelCost("");
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl text-center">Offer a Trip</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {!user && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="guestName">Your name</Label>
                <Input
                  id="guestName"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g., Alex"
                />
              </div>
              <div>
                <Label htmlFor="guestEmail">Contact email</Label>
                <Input
                  id="guestEmail"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="origin">Origin</Label>
            <Input
              id="origin"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g., Ithaca, NY"
              required
            />
          </div>
          <div>
            <Label htmlFor="destination">Destination</Label>
            <Input
              id="destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g., New York, NY"
              required
            />
          </div>
          <div>
            <Label htmlFor="datetime">Departure Time & Date</Label>
            <Input
              id="datetime"
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="seats">How many passenger seats are available?</Label>
            <Input
              id="seats"
              type="number"
              min="1"
              max="10"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              placeholder="e.g., 3"
              required
            />
          </div>
          {estArrivalTime && (
            <div className="border-t pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <Label>Est. Arrival Time</Label>
                <Input
                  value={estArrivalTime}
                  readOnly
                  className="w-1/2 text-right bg-gray-100"
                />
              </div>
              <div className="flex justify-between items-center">
                <Label>Est. Fuel Cost per Person</Label>
                <Input
                  value={estFuelCost}
                  readOnly
                  className="w-1/2 text-right bg-gray-100"
                />
              </div>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Posting..." : "Post My Trip"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default OfferRide;
