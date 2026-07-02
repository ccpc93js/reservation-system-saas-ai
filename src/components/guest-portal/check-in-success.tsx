"use client";

import { useTranslations, useLocale } from "next-intl";
import { CheckCircle, Mail, Clock } from "lucide-react";

interface CheckInSuccessProps {
  reservation: {
    reservation_number: string;
    check_in: string;
    room: { name: string; floor?: number } | null;
  };
}

export default function CheckInSuccess({
  reservation,
}: CheckInSuccessProps) {
  const t = useTranslations("guestPortal.checkInSuccess");
  const locale = useLocale();
  return (
    <div className="max-w-md w-full">
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Success icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t("title")}
        </h1>
        <p className="text-muted-foreground mb-6">
          {t("subtitle")}
        </p>

        {/* Details */}
        <div className="bg-slate-50 rounded-lg p-6 mb-6 text-left space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              {t("reservationLabel")}
            </p>
            <p className="text-sm font-mono text-foreground">
              {reservation.reservation_number}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              {t("checkInDateLabel")}
            </p>
            <p className="text-sm text-foreground">
              {new Date(reservation.check_in).toLocaleDateString(locale, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          {reservation.room && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                {t("roomLabel")}
              </p>
              <p className="text-sm text-foreground">{reservation.room.name}</p>
            </div>
          )}
        </div>

        {/* Next steps */}
        <div className="space-y-3 mb-8">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">
                {t("checkInOnDate")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("arriveWithId")}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">
                {t("checkYourEmail")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("emailConfirmationHint")}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
