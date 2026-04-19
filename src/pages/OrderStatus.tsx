import { Package } from "lucide-react";
import PhoneOrderTracker from "@/components/PhoneOrderTracker";

const OrderStatus = () => {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <Package className="w-10 h-10 text-primary mx-auto mb-3" />
          <h1 className="font-display text-3xl font-bold mb-2">Order Status Tracker</h1>
          <p className="text-muted-foreground text-sm">Track data orders with the phone number used for purchase.</p>
        </div>

        <PhoneOrderTracker
          title="Track by Phone Number"
          subtitle="Get live updates: Payment Verified, Pending Delivery, then Data Delivered."
        />
      </div>
    </div>
  );
};

export default OrderStatus;
