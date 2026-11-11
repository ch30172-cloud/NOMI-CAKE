"use client";

import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveSettings } from "@/lib/admin/settings-actions";
import { formatPhoneForDisplay } from "@/lib/whatsapp/phone";
import type { BusinessSettingsRow } from "@/types/database";

export function SettingsForm({ settings }: { settings: BusinessSettingsRow }) {
  const social = (settings.social_links ?? {}) as Record<string, string | undefined>;
  return (
    <ActionForm action={saveSettings} className="space-y-6">
      {() => (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">פרטי העסק</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="business_name">שם העסק</Label>
                <Input id="business_name" name="business_name" dir="ltr" required defaultValue={settings.business_name} />
              </div>
              <div>
                <Label htmlFor="tagline">כיתוב משנה</Label>
                <Input id="tagline" name="tagline" dir="ltr" defaultValue={settings.tagline} />
              </div>
              <div>
                <Label htmlFor="whatsapp_phone">מספר WhatsApp לקבלת הזמנות *</Label>
                <Input id="whatsapp_phone" name="whatsapp_phone" dir="ltr" placeholder="050-1234567" defaultValue={settings.whatsapp_phone ? formatPhoneForDisplay(settings.whatsapp_phone) : ""} />
                <p className="mt-1 text-xs text-muted-foreground">בלי מספר זה לקוחות לא יוכלו לשלוח את ההזמנה ב-WhatsApp.</p>
              </div>
              <div>
                <Label htmlFor="business_email">אימייל העסק (להתראות על הזמנות)</Label>
                <Input id="business_email" name="business_email" type="email" dir="ltr" defaultValue={settings.business_email ?? ""} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">איסוף, משלוחים ושעות</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="pickup_address_he">כתובת איסוף עצמי (עברית)</Label>
                <Input id="pickup_address_he" name="pickup_address_he" defaultValue={settings.pickup_address_he ?? ""} />
              </div>
              <div>
                <Label htmlFor="pickup_address_en">כתובת איסוף עצמי (אנגלית)</Label>
                <Input id="pickup_address_en" name="pickup_address_en" dir="ltr" defaultValue={settings.pickup_address_en ?? ""} />
              </div>
              <div>
                <Label htmlFor="opening_hours_he">שעות פעילות לתצוגה (עברית)</Label>
                <Textarea id="opening_hours_he" name="opening_hours_he" rows={3} defaultValue={settings.opening_hours_he ?? ""} />
              </div>
              <div>
                <Label htmlFor="opening_hours_en">שעות פעילות לתצוגה (אנגלית)</Label>
                <Textarea id="opening_hours_en" name="opening_hours_en" rows={3} dir="ltr" defaultValue={settings.opening_hours_en ?? ""} />
              </div>
              <div>
                <Label htmlFor="delivery_info_he">מידע על משלוחים (עברית)</Label>
                <Textarea id="delivery_info_he" name="delivery_info_he" rows={3} defaultValue={settings.delivery_info_he ?? ""} />
              </div>
              <div>
                <Label htmlFor="delivery_info_en">מידע על משלוחים (אנגלית)</Label>
                <Textarea id="delivery_info_en" name="delivery_info_en" rows={3} dir="ltr" defaultValue={settings.delivery_info_en ?? ""} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">הודעה חשובה ללקוחות</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="announcement_he">הודעה (עברית)</Label>
                <Input id="announcement_he" name="announcement_he" defaultValue={settings.announcement_he ?? ""} />
              </div>
              <div>
                <Label htmlFor="announcement_en">הודעה (אנגלית)</Label>
                <Input id="announcement_en" name="announcement_en" dir="ltr" defaultValue={settings.announcement_en ?? ""} />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <Switch id="announcement_active" name="announcement_active" defaultChecked={settings.announcement_active} />
                <Label htmlFor="announcement_active">להציג את ההודעה בראש האתר</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">רשתות חברתיות</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="instagram">Instagram</Label>
                <Input id="instagram" name="instagram" dir="ltr" type="url" defaultValue={social.instagram ?? ""} />
              </div>
              <div>
                <Label htmlFor="facebook">Facebook</Label>
                <Input id="facebook" name="facebook" dir="ltr" type="url" defaultValue={social.facebook ?? ""} />
              </div>
              <div>
                <Label htmlFor="tiktok">TikTok</Label>
                <Input id="tiktok" name="tiktok" dir="ltr" type="url" defaultValue={social.tiktok ?? ""} />
              </div>
            </CardContent>
          </Card>

          <SubmitButton size="lg">שמירת ההגדרות</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
