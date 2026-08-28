-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'seller', 'buyer');
CREATE TYPE public.product_status AS ENUM ('draft', 'pending_admin_review', 'approved', 'rejected');
CREATE TYPE public.certificate_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile write" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- SELLERS
CREATE TABLE public.sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT,
  description TEXT,
  logo_url TEXT,
  province TEXT,
  contact_email TEXT,
  paystack_subaccount_code TEXT,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  subscription_fee_cents INTEGER NOT NULL DEFAULT 24000,
  subscription_status public.subscription_status NOT NULL DEFAULT 'trialing',
  is_active_subscription BOOLEAN NOT NULL DEFAULT false,
  next_billing_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sellers TO anon;
GRANT SELECT, INSERT, UPDATE ON public.sellers TO authenticated;
GRANT ALL ON public.sellers TO service_role;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public sees active stores" ON public.sellers FOR SELECT TO anon, authenticated
  USING (is_active_subscription = true);
CREATE POLICY "seller reads own store" ON public.sellers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "seller creates own store" ON public.sellers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "seller updates own store" ON public.sellers FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins manage stores" ON public.sellers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER sellers_updated_at BEFORE UPDATE ON public.sellers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SUBSCRIPTION PAYMENTS
CREATE TABLE public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 24000,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'pending',
  gateway TEXT NOT NULL DEFAULT 'paystack',
  gateway_reference TEXT,
  period_start DATE,
  period_end DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller reads own payments" ON public.subscription_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid()));
CREATE POLICY "admins manage payments" ON public.subscription_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER subscription_payments_updated_at BEFORE UPDATE ON public.subscription_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  images TEXT[] NOT NULL DEFAULT '{}',
  eco_attributes TEXT[] NOT NULL DEFAULT '{}',
  is_branded BOOLEAN NOT NULL DEFAULT false,
  brand_name TEXT,
  status public.product_status NOT NULL DEFAULT 'draft',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public sees approved products of paid sellers" ON public.products FOR SELECT TO anon, authenticated
  USING (status = 'approved' AND EXISTS (
    SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.is_active_subscription = true));
CREATE POLICY "seller reads own products" ON public.products FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid()));
CREATE POLICY "seller writes own products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid()));
CREATE POLICY "seller updates own products" ON public.products FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid()));
CREATE POLICY "seller deletes own products" ON public.products FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid()));
CREATE POLICY "admins manage products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX products_seller_idx ON public.products(seller_id);
CREATE INDEX products_status_idx ON public.products(status);

-- BRAND CERTIFICATES
CREATE TABLE public.brand_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  document_path TEXT NOT NULL,
  document_type TEXT,
  certification_expiry_date DATE,
  status public.certificate_status NOT NULL DEFAULT 'pending',
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.brand_certificates TO authenticated;
GRANT ALL ON public.brand_certificates TO service_role;
ALTER TABLE public.brand_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller reads own certificates" ON public.brand_certificates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid()));
CREATE POLICY "seller uploads own certificates" ON public.brand_certificates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid()));
CREATE POLICY "admins manage certificates" ON public.brand_certificates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER brand_certificates_updated_at BEFORE UPDATE ON public.brand_certificates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- New signup -> profile + buyer role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage policies for private certificate bucket
CREATE POLICY "seller reads own certificate files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'brand-certificates' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "seller uploads own certificate files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand-certificates' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "admins read certificate files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'brand-certificates' AND public.has_role(auth.uid(), 'admin'));