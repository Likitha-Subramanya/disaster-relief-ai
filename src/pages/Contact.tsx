export default function Contact() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-40 bg-[radial-gradient(900px_500px_at_50%_-40%,rgba(244,63,94,0.35),transparent)]" />
        <div className="container py-12 md:py-16">
          <h1 className="hero-title">Contact Us</h1>
          <p className="mt-2 opacity-80">Reach out for support or information about emergency services.</p>
        </div>
      </section>
      <section className="container grid md:grid-cols-2 gap-6 pb-16">
        <div className="card p-6 space-y-3">
          <div className="section-title">Emergency Contacts</div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-4 rounded-lg border border-white/10 bg-white/5"><div className="text-sm opacity-70">National Emergency Helpline</div><div className="text-2xl font-bold">112</div></div>
            <div className="p-4 rounded-lg border border-white/10 bg-white/5"><div className="text-sm opacity-70">Police</div><div className="text-2xl font-bold">100</div></div>
            <div className="p-4 rounded-lg border border-white/10 bg-white/5"><div className="text-sm opacity-70">Fire</div><div className="text-2xl font-bold">101</div></div>
            <div className="p-4 rounded-lg border border-white/10 bg-white/5"><div className="text-sm opacity-70">Ambulance</div><div className="text-2xl font-bold">108</div></div>
          </div>
        </div>
        <form className="card p-6 space-y-4">
          <div>
            <label className="text-sm opacity-80">Your Name</label>
            <input className="input mt-1" placeholder="Your Name" />
          </div>
          <div>
            <label className="text-sm opacity-80">Your Email</label>
            <input className="input mt-1" placeholder="Your Email" />
          </div>
          <div>
            <label className="text-sm opacity-80">Your Message</label>
            <textarea className="input mt-1 h-28" placeholder="Your Message" />
          </div>
          <button className="button-primary w-full" type="button">Send Message</button>
        </form>
      </section>
    </div>
  )
}
