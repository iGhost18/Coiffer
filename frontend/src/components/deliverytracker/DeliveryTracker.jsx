
import React from "react";
import "./deliverytracker.css";

const DELIVERY_STEPS = [
  {
    key: "processing",
    label: "Processing",
  },
  {
    key: "shipped",
    label: "Shipped",
  },
  {
    key: "out_for_delivery",
    label: "Out for delivery",
  },
  {
    key: "delivered",
    label: "Delivered",
  },
];

export default function DeliveryTracker({
  order,
}) {
  const currentStatus =
    order?.deliveryStatus || "processing";

  const currentIndex =
    DELIVERY_STEPS.findIndex(
      (step) =>
        step.key === currentStatus
    );

  const safeIndex =
    currentIndex >= 0
      ? currentIndex
      : 0;

  const lastStepIndex = DELIVERY_STEPS.length - 1;

  const formatDate = (date) => {
    if (!date) return "";

    return new Date(
      date
    ).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="delivery-tracker">
      {order?.estimatedDeliveryStart &&
        order?.estimatedDeliveryEnd && (
          <div className="EstimatedDelivery">
            <strong>
              Estimated delivery
            </strong>

            <span>
              {formatDate(
                order.estimatedDeliveryStart
              )}
              {" – "}
              {formatDate(
                order.estimatedDeliveryEnd
              )}
            </span>
          </div>
        )}

      <div className="delivery-tracker-steps">
        {DELIVERY_STEPS.map(
          (step, index) => {
            const isCompleted =
              index < safeIndex ||
              (index === lastStepIndex && index === safeIndex);


            const isActive =
              index <= safeIndex;

            return (
              <div
                key={step.key}
                className={`delivery-tracker-step ${
                  isActive
                    ? "active"
                    : ""
                } ${
                  isCompleted
                    ? "completed"
                    : ""
                }`}
              >
                <div className="delivery-tracker-circle">
                  {isCompleted
                    ? "✓"
                    : index + 1}
                </div>

                <div className="delivery-tracker-label">
                  {step.label}
                </div>

                {index <
                  DELIVERY_STEPS.length -
                    1 && (
                  <div className="delivery-tracker-line" />
                )}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

