"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// Searchable country → city selector backed by country-state-city (lazy-loaded
// so its ~2MB dataset isn't in the initial bundle). Same pattern as property
// settings; produces canonical country/city names (fixes free-text data).
type CountryRec = { name: string; isoCode: string };
type CityRec = { name: string };

interface Props {
  country: string;
  city: string;
  onCountryChange: (name: string) => void;
  onCityChange: (name: string) => void;
  inputClass?: string;
  labelClass?: string;
  countryLabel?: string;
  cityLabel?: string;
}

export default function CountryCitySelect({
  country,
  city,
  onCountryChange,
  onCityChange,
  inputClass = "",
  labelClass = "",
  countryLabel = "Country",
  cityLabel = "City",
}: Props) {
  const [countries, setCountries] = useState<CountryRec[]>([]);
  const cscRef = useRef<typeof import("country-state-city") | null>(null);
  const [openCountry, setOpenCountry] = useState(false);
  const [openCity, setOpenCity] = useState(false);
  const [countryQ, setCountryQ] = useState("");
  const [cityQ, setCityQ] = useState("");
  const countryRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    import("country-state-city").then((m) => {
      if (!active) return;
      cscRef.current = m;
      setCountries(m.Country.getAllCountries());
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (openCountry && !countryRef.current?.contains(e.target as Node)) setOpenCountry(false);
      if (openCity && !cityRef.current?.contains(e.target as Node)) setOpenCity(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [openCountry, openCity]);

  const selectedCountry = countries.find((c) => c.name === country);
  const cities: CityRec[] = selectedCountry && cscRef.current
    ? cscRef.current.City.getCitiesOfCountry(selectedCountry.isoCode) ?? []
    : [];
  const filteredCountries = countries.filter((c) => c.name.toLowerCase().includes(countryQ.toLowerCase()));
  const filteredCities = cities.filter((c) => c.name.toLowerCase().includes(cityQ.toLowerCase()));

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Country */}
      <div className="relative" ref={countryRef}>
        <label className={labelClass}>{countryLabel}</label>
        <button
          type="button"
          onClick={() => { setOpenCountry((v) => !v); setCountryQ(""); }}
          className={`${inputClass} flex items-center justify-between text-left`}
        >
          <span className={country ? "" : "text-muted-foreground"}>{country || "Select country"}</span>
          <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
        </button>
        {openCountry && (
          <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-surface shadow-lg overflow-hidden">
            <div className="p-2 border-b border-border">
              <input
                autoFocus
                value={countryQ}
                onChange={(e) => setCountryQ(e.target.value)}
                placeholder="Search country..."
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredCountries.map((c) => (
                <button
                  key={c.isoCode}
                  type="button"
                  onClick={() => { onCountryChange(c.name); onCityChange(""); setOpenCountry(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${country === c.name ? "bg-accent/10 text-accent font-medium" : "text-foreground hover:bg-muted"}`}
                >
                  {c.name}
                </button>
              ))}
              {filteredCountries.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">No results</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* City */}
      <div className="relative" ref={cityRef}>
        <label className={labelClass}>{cityLabel}</label>
        <button
          type="button"
          disabled={!selectedCountry}
          onClick={() => { setOpenCity((v) => !v); setCityQ(""); }}
          className={`${inputClass} flex items-center justify-between text-left disabled:opacity-50`}
        >
          <span className={city ? "" : "text-muted-foreground"}>
            {city || (selectedCountry ? "Select city" : "Select country first")}
          </span>
          <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
        </button>
        {openCity && selectedCountry && (
          <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-surface shadow-lg overflow-hidden">
            <div className="p-2 border-b border-border">
              <input
                autoFocus
                value={cityQ}
                onChange={(e) => setCityQ(e.target.value)}
                placeholder="Search city..."
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredCities.map((c, i) => (
                <button
                  key={`${c.name}-${i}`}
                  type="button"
                  onClick={() => { onCityChange(c.name); setOpenCity(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${city === c.name ? "bg-accent/10 text-accent font-medium" : "text-foreground hover:bg-muted"}`}
                >
                  {c.name}
                </button>
              ))}
              {filteredCities.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">No results</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
