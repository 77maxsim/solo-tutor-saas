import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Students() {
  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Students</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your student profiles and contact information.
          </p>
        </div>
      </header>

      {/* Students Content */}
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Student Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Student management functionality coming soon...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
