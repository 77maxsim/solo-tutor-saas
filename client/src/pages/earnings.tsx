import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Earnings() {
  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Earnings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your income and payment history.
          </p>
        </div>
      </header>

      {/* Earnings Content */}
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Earnings Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Earnings tracking functionality coming soon...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
