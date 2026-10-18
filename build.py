"""Generates the six TriadaTechnologies pages. Run: python3 build.py"""
import hashlib
import html
import json
import os
import re

NAV = [
    ("index.html", "Home"),
    ("services.html", "Services"),
    ("about.html", "About"),
    ("jobs.html", "Jobs"),
    ("insights.html", "Insights"),
    ("contact.html", "Contact"),
]

PHONE = "+1 469 396 2108"
PHONE_HREF = "tel:+14693962108"
EMAIL = "hr@triadatechnologies.com"


SITE = "https://triadatechnologies.com"
OG_IMAGE = SITE + "/assets/og-image.jpg"
OG_ALT = "TriadaTechnologies, staffing in Lansdale, PA"


def head(title, desc, page, schema="", og_type="website", noindex=False):
    url = SITE + "/" + ("" if page == "index.html" else page)
    e = html.escape
    robots = "noindex, follow" if noindex else "index, follow, max-image-preview:large"
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta name="robots" content="{robots}">
<meta name="theme-color" content="#FAFAFA">
<link rel="canonical" href="{url}">
<meta property="og:site_name" content="TriadaTechnologies">
<meta property="og:locale" content="en_US">
<meta property="og:type" content="{og_type}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{OG_ALT}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(title)}">
<meta name="twitter:description" content="{e(desc)}">
<meta name="twitter:image" content="{OG_IMAGE}">
<link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32.png">
<link rel="icon" type="image/png" sizes="512x512" href="assets/favicon-512.png">
<link rel="apple-touch-icon" sizes="180x180" href="assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;500;600&family=Google+Sans+Flex:wght@400;500;600&display=swap">
<link rel="stylesheet" href="assets/site.css">
{schema}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
'''


def ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False).replace("</", "<\\/") + "</script>\n"


def breadcrumb(*crumbs):
    """crumbs: (name, page) pairs after Home."""
    items = [("Home", "")] + [(n, p) for n, p in crumbs]
    return ld({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + "/" + p} for i, (n, p) in enumerate(items)]})


ORG_ID = SITE + "/#organization"


def org(with_phone=False):
    o = {"@type": ["Organization", "EmploymentAgency"], "@id": ORG_ID, "name": "TriadaTechnologies",
         "url": SITE + "/", "logo": SITE + "/assets/logo.svg", "image": OG_IMAGE,
         "description": "Multi-industry staffing and recruitment partner in Lansdale, PA, providing temporary, contract, contract-to-hire, direct-hire, and executive search services.",
         "email": EMAIL,
         "address": {"@type": "PostalAddress", "addressLocality": "Lansdale", "addressRegion": "PA", "addressCountry": "US"},
         "areaServed": {"@type": "Country", "name": "United States"},
         "knowsAbout": ["Contract staffing", "Contract-to-hire", "Direct hire placement", "Executive search", "Vendor management systems", "Technology hiring"]}
    if with_phone:
        o["telephone"] = PHONE
    return o


def header(active):
    if active.startswith("insight"):
        active = "insights.html"
    links = "\n".join(
        '        <li><a href="{}"{}>{}</a></li>'.format(
            href, ' aria-current="page"' if href == active else "", label)
        for href, label in NAV
    )
    return f'''<header class="site">
  <div class="wrap bar">
    <a class="brand" href="index.html" aria-label="TriadaTechnologies home"><img src="assets/logo.svg" width="116" height="34" alt="TriadaTechnologies"></a>
    <nav aria-label="Main">
      <ul>
{links}
      </ul>
    </nav>
    <div class="header-cta">
      <a class="btn btn-white" href="jobs.html">Find work</a>
      <a class="btn btn-white" href="contact.html">Hire talent</a>
    </div>
  </div>
</header>
'''


FOOTER = f'''<footer class="site-foot">
  <div class="wrap foot">
    <div>
      <img src="assets/logo.svg" width="116" height="34" alt="TriadaTechnologies">
      <p style="margin-top:13px">Staffing and recruitment in Lansdale, PA.</p>
    </div>
    <div>
      <p>Lansdale, PA</p>
      <p><a href="mailto:{EMAIL}">{EMAIL}</a></p>
      <p><a href="contact.html">Contact page</a></p>
    </div>
    <div>
      <p><a href="services.html">Services</a> · <a href="jobs.html">Jobs</a> · <a href="insights.html">Insights</a></p>
      <p><a href="about.html">About</a> · <a href="contact.html">Contact</a></p>
      <p class="copy">© 2026 TriadaTechnologies. All rights reserved.</p>
    </div>
  </div>
</footer>
'''


def page(title, desc, page_name, body, script=False, schema="", og_type="website", noindex=False):
    s = (head(title, desc, page_name, schema, og_type, noindex) + header(page_name)
         + '\n<main id="main">\n' + body + '\n</main>\n\n' + FOOTER)
    if script:
        s += '\n<script src="assets/site.js"></script>\n'
    return s + '</body>\n</html>\n'


def cta_card():
    return f'''<section>
  <div class="wrap">
    <div class="cta-card">
      <div class="copy">
        <p class="eyebrow">Next step</p>
        <h2>Bring us the role. We will bring back people who fit it.</h2>
        <p>Share the job title, the main responsibilities, and your timeline. A recruiter from our Lansdale team will review the details and reply during business hours with clear next steps, so you know exactly what happens next.</p>
      </div>
      <div class="cta-panel">
        <p class="label">Email</p>
        <a class="mail" href="mailto:{EMAIL}">{EMAIL}</a>
        <a class="btn btn-solid" href="contact.html">Contact us</a>
      </div>
    </div>
  </div>
</section>
'''


INDUSTRIES = [
    ("IT and Technology", "Software engineers, cloud and DevOps architects, cybersecurity analysts, database administrators, and system administrators for teams that depend on stable, secure systems."),
    ("Healthcare and Life Sciences", "Registered nurses, allied health professionals, medical administrators, and clinical research staff who meet strict credentialing and compliance standards."),
    ("Finance and Accounting", "CPAs, financial analysts, accounts payable and receivable specialists, internal auditors, and tax professionals for accurate, on-time financial operations."),
    ("Engineering and Construction", "Mechanical, electrical, and civil engineers, project managers, and technical drafters who keep complex projects moving within scope and schedule."),
    ("Administrative and Clerical", "Executive assistants, office coordinators, data entry specialists, and general office support that keeps daily operations organized and efficient."),
    ("Manufacturing and Industrial", "Production supervisors, quality control inspectors, CNC machinists, and assembly teams trained to your safety and production standards."),
    ("Logistics and Supply Chain", "Warehouse managers, inventory planners, logistics coordinators, and distribution specialists who keep goods moving from supplier to customer."),
    ("Telecommunications", "Network technicians, fiber installers, RF engineers, and telecom project coordinators for reliable connectivity and infrastructure build-outs."),
    ("Retail and Customer Support", "Call center agents, customer service representatives, retail managers, and customer experience specialists who represent your brand every day."),
]
industries_html = "\n".join(
    f'      <div class="card"><h3>{t}</h3><p>{d}</p></div>' for t, d in INDUSTRIES)

STEPS = [
    ("Consultation", "We confirm the requirements, the technical skills, the team culture, the working schedule, and the timeline. A clear brief makes every later step faster."),
    ("Sourcing", "We search our local candidate database, industry networks, and referrals to find people who match the role, including those who are not actively looking."),
    ("Screening", "Each candidate completes skill reviews and behavioral interviews, and we verify background and credentials where the role requires it."),
    ("Presentation", "You receive a short list with each candidate's qualifications, experience, and fit for your team, summarized so you can decide quickly."),
    ("Placement", "We coordinate interviews, help with offer terms, and manage the paperwork and onboarding so the new hire starts on the right foot."),
    ("Follow-up", "We check in with you and the new hire during the first weeks, so any concern is addressed early and the placement succeeds."),
]
steps_html = "\n".join(
    f'      <li><h3>{t}</h3><p>{d}</p></li>' for t, d in STEPS)

# ---------- HOME ----------
HOME_SCHEMA = ld({"@context": "https://schema.org", "@graph": [
    org(),
    {"@type": "WebSite", "@id": SITE + "/#website", "url": SITE + "/", "name": "TriadaTechnologies",
     "inLanguage": "en-US", "publisher": {"@id": ORG_ID}},
]})

home = f'''<section class="hero-full" aria-label="Introduction">
  <img class="hero-video hero-img" src="assets/hero-city.jpg" alt="City skyline at dusk" width="1920" height="1280" fetchpriority="high" decoding="async">
  <div class="hero-shade" aria-hidden="true"></div>
  <div class="hero-center">
    <p class="eyebrow">Staffing in Lansdale, PA</p>
    <h1>Creating value for everyone.</h1>
  </div>
</section>

<section id="intro" class="intro">
  <div class="wrap hero-grid">
    <div>
      <p class="lead">Creating value for every side of the hiring journey. TriadaTechnologies connects clients, vendors, and candidates through temporary, contract, contract-to-hire, and direct-hire staffing. We keep the process clear, the screening careful, and every placement built to last.</p>
      <div class="hero-actions">
        <a class="btn btn-white" href="contact.html">Hire talent</a>
        <a class="btn btn-white" href="jobs.html">Find work</a>
      </div>
    </div>
    <aside class="hook" aria-label="Why hiring speed matters">
      <p class="eyebrow">The real cost of waiting</p>
      <strong>Every open seat slows down the work your team was hired to do.</strong>
      <p>Projects stall, deadlines slip, and the people already carrying the load start to feel the strain. We find candidates who match the role and the team, screen them with care, and bring them in ready to contribute. Once the seat is filled, your team can return to its best work, with the steady confidence that progress is moving again.</p>
      <p class="call">Reach us at <a href="contact.html">our contact page</a> to start.</p>
    </aside>
  </div>
</section>

<div class="marquee" aria-hidden="true">
  <div class="marquee-track">
    <span>IT and technology</span><span>Healthcare</span><span>Finance and accounting</span><span>Engineering</span><span>Administrative</span><span>Manufacturing</span><span>Logistics</span><span>Telecommunications</span><span>Retail and support</span>
    <span>IT and technology</span><span>Healthcare</span><span>Finance and accounting</span><span>Engineering</span><span>Administrative</span><span>Manufacturing</span><span>Logistics</span><span>Telecommunications</span><span>Retail and support</span>
  </div>
</div>

<section>
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Our approach</p>
      <h2>Clear requirements, <em>careful screening</em>, honest follow-up.</h2>
      <p class="lead">A good placement starts well before the first interview. We take the time to understand the role, so the candidates you see reflect what your team truly needs.</p>
    </div>
    <div class="values">
      <div class="card"><h3>Clear requirements</h3><p>We confirm the skills, working environment, schedule, and the outcomes that define success for the role before we begin sourcing.</p></div>
      <div class="card"><h3>Careful screening</h3><p>Every candidate is reviewed for technical fit, communication, and reliability, so the shortlist you receive is ready for a decision.</p></div>
      <div class="card"><h3>Honest follow-up</h3><p>We stay in touch after the start date with you and the new hire, so small concerns are resolved early instead of becoming problems.</p></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Services</p>
      <h2>Three ways to bring talent <em>on board</em></h2>
      <p class="lead">Choose the arrangement that matches your hiring need, budget, and timeline. We will help you decide which one fits the role best.</p>
    </div>
    <div class="trio">
      <div class="card"><h3>Temporary and contract</h3><p>Short-term and project-based professionals who can start quickly and work to your schedule, for seasonal demand, special projects, and backfill coverage.</p></div>
      <div class="card"><h3>Contract-to-hire</h3><p>Work with a candidate first, then decide whether to bring them on permanently. You see their work in your own environment before making a long-term commitment.</p></div>
      <div class="card"><h3>Direct hire</h3><p>Permanent placements with a shortlist built around the role, your team, and your culture. We handle sourcing, screening, and coordination from first call to offer.</p></div>
    </div>
    <p style="margin-top:34px"><a class="btn btn-white" href="services.html">View services</a></p>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Clients and candidates</p>
      <h2>Built for both sides of the <em>hiring journey</em></h2>
    </div>
    <div class="duo">
      <div class="card">
        <h3>For clients</h3>
        <p>Tell us what you need to staff. We will send a shortlist built around your team, your budget, your timeline, and the way your team works day to day. You stay in control of every decision, from interviews to offers.</p>
        <a class="btn btn-white" href="contact.html">Hire talent</a>
      </div>
      <div class="card">
        <h3>For candidates</h3>
        <p>Share your resume and the roles you want. Our recruiters review your background, match you with openings that fit your skills, and keep you informed at every step. We will reach out when a matching opportunity comes up.</p>
        <a class="btn btn-white" href="jobs.html">Find work</a>
      </div>
    </div>
  </div>
</section>

{cta_card()}'''

# ---------- SERVICES ----------
SERVICES_SCHEMA = ""

FAQ_ITEMS = [
    ("What types of staffing do you offer?",
     "We offer temporary, contract, contract-to-hire, direct hire, and executive search placements, along with vendor management programs for ongoing workforce needs."),
    ("Where are you located?",
     "TriadaTechnologies is based in Lansdale, Pennsylvania. We work with employers and candidates across multiple industries in the region and beyond."),
    ("How do I get started?",
     f'Visit our <a href="contact.html">contact page</a> or email {EMAIL} with the role you need to fill, or with the roles you are looking for. A recruiter will reply during business hours.'),
]
faq_html = "\n".join(
    f'      <div class="card">\n        <h3>{q}</h3>\n        <p>{a}</p>\n      </div>' for q, a in FAQ_ITEMS)

services = f'''<section class="page-hero" style="border-top:0">
  <div class="wrap">
    <p class="eyebrow">Services</p>
    <h1>Staffing for <em>every stage</em> of hiring.</h1>
    <p class="lead">Temporary, contract, contract-to-hire, direct placement, and executive search, with vetted talent across nine industries. We shape each engagement around your schedule, your budget, and the level of responsibility the role carries.</p>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Arrangements</p>
      <h2>Four ways to staff your team</h2>
      <p class="lead">Each arrangement balances speed, cost, and commitment differently. We will help you choose the one that fits your situation.</p>
    </div>
    <div class="quad">
      <div class="card"><h3>Temporary and contract</h3><p>Short-term and project-based professionals who can start quickly and work to your schedule. Ideal for seasonal demand, special projects, and backfill coverage.</p></div>
      <div class="card"><h3>Contract-to-hire</h3><p>Work with a candidate first, then decide whether to bring them on permanently. You see their work in your environment before making a long-term commitment.</p></div>
      <div class="card"><h3>Direct hire</h3><p>Permanent placements with a shortlist built around the role, the team, and the culture. We manage sourcing, screening, and coordination from start to offer.</p></div>
      <div class="card"><h3>Executive search and VMS</h3><p>Senior search for leadership roles, plus vendor management programs that keep ongoing workforce needs organized, compliant, and cost-aware.</p></div>
    </div>
  </div>
</section>

<section id="industries">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Industries</p>
      <h2>Talent across the sectors we support</h2>
      <p class="lead">From technical specialists to administrative support, we place people who meet your industry's requirements, credentials, and standards.</p>
    </div>
    <div class="industries">
{industries_html}
    </div>
  </div>
</section>

<section id="process">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Process</p>
      <h2>How a placement works</h2>
      <p class="lead">Six clear steps, from the first conversation to a placement that keeps performing after the start date.</p>
    </div>
    <ol class="steps">
{steps_html}
    </ol>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Questions</p>
      <h2>Common questions about staffing with us</h2>
    </div>
    <div class="faq">
{faq_html}
    </div>
  </div>
</section>

{cta_card()}'''

# ---------- ABOUT ----------
about = '''<section class="page-hero" style="border-top:0">
  <div class="wrap">
    <p class="eyebrow">About</p>
    <h1>Connecting clients, <em>vendors, and candidates.</em></h1>
    <p class="lead">TriadaTechnologies is a multi-industry staffing and workforce solutions partner in Lansdale, Pennsylvania. We build smart, long-term relationships that help organizations grow and help professionals move their careers forward.</p>
  </div>
</section>

<section>
  <div class="wrap prose">
    <div>
      <p class="eyebrow">Who we are</p>
      <h2>A multi-industry staffing partner</h2>
    </div>
    <div>
      <p class="body">TriadaTechnologies is a multi-industry recruitment and workforce solutions partner based in Lansdale, Pennsylvania. We connect organizations with skilled talent across technology, healthcare, finance, engineering, logistics, and more, with a focus on roles that are hard to fill and on teams that need dependable support.</p>
      <p class="body">We work to bridge the gap between candidates, vendors, and client goals. Every engagement begins with understanding the work itself, so that the people we place can succeed in their roles and the organizations we serve can keep their momentum.</p>
      <p class="body">Our team focuses on quality, reliability, and speed in every partnership. We would rather be precise and honest with you than promise more than the role can deliver.</p>
    </div>
  </div>
</section>

<section>
  <div class="wrap prose">
    <div>
      <p class="eyebrow">Mission</p>
      <h2>What we commit to</h2>
    </div>
    <div>
      <ul class="mission-list">
        <li>Build recruitment solutions that match our clients' business goals, culture, and timelines.</li>
        <li>Connect job seekers with opportunities that fit their skills and their long-term career goals.</li>
        <li>Work with vendors to build staffing programs that are efficient, compliant, and able to scale with demand.</li>
        <li>Hold every placement to a high standard of professionalism, speed, and accuracy.</li>
      </ul>
    </div>
  </div>
</section>

<section>
  <div class="wrap prose">
    <div>
      <p class="eyebrow">Vision</p>
      <h2>Where we are going</h2>
    </div>
    <div>
      <p class="body">To be the most trusted workforce solutions provider in our region, recognized for building high-performing teams and for fostering long-term relationships that outlast any single placement.</p>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Core values</p>
      <h2>How we work</h2>
      <p class="lead">Six principles guide our recruiters, from the first call to the final follow-up.</p>
    </div>
    <div class="values">
      <div class="card"><h3>Integrity</h3><p>We are open, honest, and ethical in every business dealing, including when the answer is not the one someone hoped to hear.</p></div>
      <div class="card"><h3>Collaboration</h3><p>We work across teams to meet the needs of clients, candidates, and partners, and we keep everyone informed as the work moves forward.</p></div>
      <div class="card"><h3>Excellence</h3><p>We hold every placement and every service to a high standard, and we check the details before we present a candidate or a proposal.</p></div>
      <div class="card"><h3>Commitment</h3><p>We care about the long-term success of both the businesses we serve and the professionals we place, not only the first day of work.</p></div>
      <div class="card"><h3>People first</h3><p>We put human connection and personal career goals ahead of transactions, because the right fit is the one that lasts.</p></div>
      <div class="card"><h3>Innovation</h3><p>We use modern recruiting tools and practices to make staffing faster, clearer, and easier to measure for the teams we support.</p></div>
    </div>
  </div>
</section>'''

# ---------- JOBS ----------
jobs = '''<section class="page-hero" style="border-top:0">
  <div class="wrap">
    <div class="page-hero-row">
      <div>
        <p class="eyebrow">Jobs</p>
        <h1>Open <em>roles.</em></h1>
        <p class="lead">Current openings with our clients are listed here, each with a clear description of the responsibilities, skills, and location. If nothing matches yet, send us your resume and we will contact you when a suitable role opens.</p>
      </div>
      <div class="admin-slot">
        <button class="btn btn-solid" type="button" id="post-job-btn">Post a job</button>
        <small>Admin only</small>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Current openings</p>
      <h2>No openings listed right now</h2>
      <p class="lead">Our recruiters are always building their candidate pipeline. Send us your resume and the roles you are looking for, and we will reach out when a matching position opens.</p>
    </div>
    <div class="card" style="max-width:610px">
      <h3>Submit your resume</h3>
      <p>Include the job titles you are targeting, your core skills, and your preferred work arrangement, whether that is temporary, contract, contract-to-hire, or direct hire.</p>
      <a class="btn btn-white" href="contact.html">Submit resume</a>
    </div>
  </div>
</section>'''

# ---------- INSIGHTS ----------
import datetime as dt
import json
import os

SITE_URL = "https://triadatechnologies.com"
LIVE_DAYS = 30
BASE = os.path.dirname(os.path.abspath(__file__))


def build_date():
    v = os.environ.get("BUILD_DATE")
    return dt.date.fromisoformat(v) if v else dt.date.today()


def load_posts():
    d = os.path.join(BASE, "data", "insights")
    posts = []
    if os.path.isdir(d):
        for n in sorted(os.listdir(d)):
            if n.endswith(".json"):
                with open(os.path.join(d, n), encoding="utf-8") as f:
                    posts.append(json.load(f))
    posts.sort(key=lambda p: p["published"], reverse=True)
    return posts


def pretty(iso):
    d = dt.date.fromisoformat(iso)
    return d.strftime("%b ") + str(d.day) + d.strftime(", %Y")


def art_src(p):
    return f"assets/insights/{p['slug']}.svg" if p.get("has_art") else "assets/illustration.svg"


def post_card(p):
    url = f"insight-{p['slug']}.html"
    e = html.escape
    hay = e((p['title'] + ' ' + p['summary'] + ' ' + p['tag']).lower(), quote=True)
    return f'''      <article class="card post-card" data-item data-date="{p['published']}" data-text="{hay}">
        <a class="post-art pal-{e(p['palette'])}" href="{url}" aria-hidden="true" tabindex="-1"><img src="{art_src(p)}" alt="" width="400" height="300" loading="lazy"></a>
        <p class="meta">{pretty(p['published'])} · {e(p['tag'])}</p>
        <h3><a href="{url}">{e(p['title'])}</a></h3>
        <p>{e(p['summary'])}</p>
      </article>'''


def archive_row(p):
    url = f"insight-{p['slug']}.html"
    e = html.escape
    hay = e((p['title'] + ' ' + p['summary'] + ' ' + p['tag']).lower(), quote=True)
    return (f'      <li class="archive-row" data-item data-date="{p["published"]}" data-text="{hay}">'
            f'<a href="{url}">{e(p["title"])}</a><span>{pretty(p["published"])} · {e(p["tag"])}</span></li>')


def toolbar(posts, archive_button):
    months = sorted({p["published"][:7] for p in posts}, reverse=True)
    opts = "".join(f'<option value="{m}">{dt.date.fromisoformat(m + "-01").strftime("%B %Y")}</option>' for m in months)
    btn = '\n      <a class="btn btn-white" href="insights-archive.html">Archive</a>' if archive_button else ""
    return f'''    <div class="toolbar{' toolbar-wide' if archive_button else ''}">
      <label for="q">Search
        <input id="q" type="search" placeholder="Search articles" autocomplete="off">
      </label>
      <label for="month">Date
        <select id="month"><option value="">All dates</option>{opts}</select>
      </label>
      <label for="sort">Sort
        <select id="sort"><option value="new">Latest first</option><option value="old">Oldest first</option></select>
      </label>{btn}
    </div>'''


def hero_card(eyebrow, title_html, lead):
    return f'''<section class="page-hero hero-carded" style="border-top:0">
  <div class="wrap">
    <div class="hero-card">
      <p class="eyebrow">{eyebrow}</p>
      <h1>{title_html}</h1>
      <p class="lead">{lead}</p>
    </div>
  </div>
</section>
'''


def build_insights(posts, today):
    live = [p for p in posts if (today - dt.date.fromisoformat(p["published"])).days <= LIVE_DAYS]
    old = [p for p in posts if p not in live]
    hero = hero_card("Insights", "Notes on <em>hiring</em> and the job market.",
                     "Short, sourced articles on technology hiring, in-demand skills, and workforce planning, for clients planning their teams and candidates planning their next role.")
    if not live and not old:
        return hero + '''
<section>
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Coming soon</p>
      <h2>Our first articles are on the way</h2>
      <p class="lead">We will publish practical guidance on hiring trends, role requirements, and career moves in the industries we serve. Check back soon, or contact our team with a question you would like answered.</p>
    </div>
    <div class="card" style="max-width:610px">
      <h3>Ask a question</h3>
      <p>Tell us which hiring or career topic you would like us to cover, and our team will consider it for an upcoming article.</p>
      <a class="btn btn-white" href="contact.html">Ask a question</a>
    </div>
  </div>
</section>'''
    cards = chr(10).join(post_card(p) for p in live)
    return hero + f'''
<section class="listing" data-page="9">
  <div class="wrap">
{toolbar(live, True)}
    <div class="posts" id="items">
{cards}
    </div>
    <p id="empty" class="archive-empty" hidden>No articles match your search.</p>
    <div class="load-more"><button class="btn btn-white" type="button" id="more" hidden>Load more</button></div>
  </div>
</section>'''


def build_archive(posts, today):
    old = [p for p in posts if (today - dt.date.fromisoformat(p["published"])).days > LIVE_DAYS]
    hero = hero_card("Archive", "Earlier <em>articles.</em>",
                     "Articles older than 30 days are kept here for 12 months, as a simple list you can search and sort.")
    if not old:
        body = '''    <p class="archive-empty">No archived articles yet. Articles move here 30 days after they are published.</p>
    <p style="margin-top:20px"><a class="btn btn-white" href="insights.html">Back to Insights</a></p>'''
    else:
        body = f'''{toolbar(old, False)}
    <ul class="archive-list" id="items">
{chr(10).join(archive_row(p) for p in old)}
    </ul>
    <p id="empty" class="archive-empty" hidden>No articles match your search.</p>
    <div class="load-more"><button class="btn btn-white" type="button" id="more" hidden>Load more</button></div>
    <p style="margin-top:32px"><a class="btn btn-white" href="insights.html">Back to Insights</a></p>'''
    return hero + f'''
<section class="listing" data-page="20">
  <div class="wrap">
{body}
  </div>
</section>'''


def build_post(p):
    e = html.escape
    secs = "".join(
        f'<h2>{e(s["heading"])}</h2>' + "".join(f"<p>{e(t)}</p>" for t in s["paragraphs"])
        for s in p["sections"])
    take = "".join(f"<li>{e(t)}</li>" for t in p["takeaways"])
    srcs = "".join(f'<li><a href="{e(s["url"], quote=True)}" rel="noopener" target="_blank">{e(s["title"])}</a></li>' for s in p["sources"])
    return f'''<section class="page-hero hero-carded" style="border-top:0">
  <div class="wrap article-head">
    <div class="hero-card">
      <p class="eyebrow">{e(p['tag'])}</p>
      <h1>{e(p['title'])}</h1>
      <p class="lead">{e(p['summary'])}</p>
      <p class="meta">Published {pretty(p['published'])} · Updated {pretty(p['updated'])}</p>
    </div>
  </div>
</section>

<section>
  <div class="wrap article">
    <div class="post-art pal-{e(p['palette'])} post-art-lg"><img src="{art_src(p)}" alt="" width="400" height="300"></div>
    <div class="article-body">
      {secs}
      <div class="card takeaways"><h3>Key takeaways</h3><ul>{take}</ul></div>
      <h2>Sources</h2>
      <ul class="sources">{srcs}</ul>
      <p class="ai-note">This article was prepared with AI assistance from the sources listed above and published by TriadaTechnologies.</p>
      <p><a class="btn btn-white" href="insights.html">All insights</a></p>
    </div>
  </div>
</section>'''


def post_schema(p):
    url = f"{SITE}/insight-{p['slug']}.html"
    words = sum(len(t.split()) for sec in p["sections"] for t in sec["paragraphs"])
    article = {
        "@context": "https://schema.org", "@type": "Article",
        "headline": p["title"], "description": p["description"],
        "datePublished": p["published"], "dateModified": p["updated"],
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
        "articleSection": p["tag"], "inLanguage": "en-US", "wordCount": words,
        "image": OG_IMAGE,
        "author": {"@id": ORG_ID}, "publisher": {"@id": ORG_ID},
        "isPartOf": {"@type": "WebSite", "@id": SITE + "/#website"},
        "citation": [s["url"] for s in p["sources"]],
    }
    return ld(article) + breadcrumb(("Insights", "insights.html"), (p["title"], f"insight-{p['slug']}.html"))


def plain(t):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", t)).strip()


def page_schema(fname):
    if fname == "index.html":
        return HOME_SCHEMA
    if fname == "services.html":
        faq = ld({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": plain(a)}} for q, a in FAQ_ITEMS]})
        return breadcrumb(("Services", fname)) + faq
    if fname == "about.html":
        return breadcrumb(("About", fname)) + ld({"@context": "https://schema.org", "@type": "AboutPage",
                                                   "name": "About TriadaTechnologies", "url": f"{SITE}/{fname}", "about": {"@id": ORG_ID}})
    if fname == "jobs.html":
        return breadcrumb(("Jobs", fname))
    if fname == "insights.html":
        return breadcrumb(("Insights", fname)) + ld({"@context": "https://schema.org", "@type": "CollectionPage",
                                                      "name": "Insights on hiring and the job market", "url": f"{SITE}/{fname}",
                                                      "isPartOf": {"@id": SITE + "/#website"}, "publisher": {"@id": ORG_ID}})
    if fname == "insights-archive.html":
        return breadcrumb(("Insights", "insights.html"), ("Archive", fname))
    if fname == "contact.html":
        return breadcrumb(("Contact", fname)) + ld({"@context": "https://schema.org", "@type": "ContactPage",
                                                     "name": "Contact TriadaTechnologies", "url": f"{SITE}/{fname}",
                                                     "mainEntity": org(with_phone=True)})
    return ""


# real "last modified" dates: a page's date only moves when its content changes
LASTMOD_FILE = os.path.join(BASE, "data", "lastmod.json")


def lastmod_for(outputs, today):
    try:
        with open(LASTMOD_FILE, encoding="utf-8") as f:
            book = json.load(f)
    except Exception:
        book = {}
    for name, text in outputs.items():
        h = hashlib.sha1(text.encode("utf-8")).hexdigest()
        if book.get(name, {}).get("hash") != h:
            book[name] = {"hash": h, "date": today.isoformat()}
    with open(LASTMOD_FILE, "w", encoding="utf-8") as f:
        json.dump(book, f, indent=1, sort_keys=True)
    return {n: v["date"] for n, v in book.items()}


def seo_files(posts, today, dates):
    names = [n for n, _ in NAV] + ["insights-archive.html"] + [f"insight-{p['slug']}.html" for p in posts]
    items = "".join(
        f"  <url><loc>{SITE_URL}/{'' if n == 'index.html' else n}</loc><lastmod>{dates.get(n, today.isoformat())}</lastmod></url>\n"
        for n in names)
    with open("sitemap.xml", "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + items + "</urlset>\n")
    with open("robots.txt", "w", encoding="utf-8") as f:
        f.write(f"User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}/sitemap.xml\n")
    lines = ["# TriadaTechnologies", "",
             "> Staffing and recruitment firm in Lansdale, PA. Temporary, contract, contract-to-hire, and direct-hire placement across IT, healthcare, finance, engineering, and more.", "",
             "## Pages", ""]
    lines += [f"- [{label}]({SITE_URL}/{'' if n == 'index.html' else n})" for n, label in NAV]
    if posts:
        lines += ["", "## Insights", ""]
        lines += [f"- [{p['title']}]({SITE_URL}/insight-{p['slug']}.html): {p['summary']} ({p['published']})" for p in posts]
    with open("llms.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def retired_slugs():
    try:
        with open(os.path.join(BASE, "data", "retired.json"), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def redirect_page(target):
    return (f'<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Moved | TriadaTechnologies</title>\n'
            f'<meta name="robots" content="noindex, follow">\n<link rel="canonical" href="{SITE}/{target}">\n'
            f'<meta http-equiv="refresh" content="0; url={target}"></head>\n'
            f'<body><p>This article has moved to the <a href="{target}">archive</a>.</p></body></html>\n')


POSTS = load_posts()
TODAY = build_date()
insights = build_insights(POSTS, TODAY)
archive_page = build_archive(POSTS, TODAY)

# ---------- CONTACT ----------
contact = f'''<section class="page-hero" style="border-top:0">
  <div class="wrap contact-grid">
    <div class="details">
      <p class="eyebrow">Contact</p>
      <h1>Get in <em>touch.</em></h1>
      <p class="lead">Tell us what you are hiring for or what you are looking for, and a member of our team will respond.</p>
      <dl>
        <div><dt>Phone</dt><dd><a href="{PHONE_HREF}">{PHONE}</a></dd></div>
        <div><dt>Email</dt><dd><a href="mailto:{EMAIL}">{EMAIL}</a></dd></div>
      </dl>
    </div>

    <form id="contact-form" class="contact-form" novalidate>
      <div class="field-row">
        <label for="name">Full name
          <input id="name" name="name" type="text" autocomplete="name" required>
        </label>
        <label for="company">Company (optional)
          <input id="company" name="company" type="text" autocomplete="organization">
        </label>
      </div>
      <div class="field-row">
        <label for="email">Email
          <input id="email" name="email" type="email" autocomplete="email" required>
        </label>
        <label for="phone">Phone
          <input id="phone" name="phone" type="tel" autocomplete="tel">
        </label>
      </div>
      <label for="reason">I am
        <select id="reason" name="reason">
          <option value="client">Hiring talent</option>
          <option value="candidate">Looking for work</option>
          <option value="vendor">A vendor or partner</option>
        </select>
      </label>
      <label for="message">Message
        <textarea id="message" name="message" required></textarea>
      </label>
      <div><button class="btn btn-solid" type="submit">Send message</button></div>
      <p class="form-note">This is a preview. The form is not connected yet, so nothing is sent.</p>
      <p id="form-status" role="status" aria-live="polite"></p>
    </form>
  </div>
</section>
'''

pages = [
    ("index.html", "TriadaTechnologies | Staffing in Lansdale, PA",
     "TriadaTechnologies is a Lansdale, PA staffing firm placing temporary, contract, contract-to-hire, and direct-hire talent in IT, healthcare, and finance.",
     home, True, HOME_SCHEMA),
    ("services.html", "Staffing Services | TriadaTechnologies",
     "Temporary, contract, contract-to-hire, direct hire, and executive search staffing in nine industries, from TriadaTechnologies in Lansdale, PA.",
     services, True, ""),
    ("about.html", "About TriadaTechnologies | Lansdale, PA Staffing",
     "About TriadaTechnologies, a multi-industry staffing and recruitment partner in Lansdale, PA, connecting clients, vendors, and candidates.",
     about, True, ""),
    ("jobs.html", "Open Jobs | TriadaTechnologies",
     "Current job openings with TriadaTechnologies clients in Lansdale, PA, and how to submit your resume for temporary, contract, or direct-hire roles.",
     jobs, True, ""),
    ("insights.html", "Insights on Hiring | TriadaTechnologies",
     "Sourced articles on technology hiring, in-demand skills, and workforce planning from TriadaTechnologies, a staffing firm in Lansdale, PA.",
     insights, True, ""),
    ("insights-archive.html", "Insights Archive | TriadaTechnologies",
     "Searchable list of earlier TriadaTechnologies articles on technology hiring, in-demand skills, and workforce planning, kept for 12 months.",
     archive_page, True, ""),
    ("contact.html", "Contact TriadaTechnologies | Lansdale, PA",
     f"Contact TriadaTechnologies in Lansdale, PA. Call {PHONE} or email {EMAIL} to hire talent or submit your resume.",
     contact, True, ""),
]

if __name__ == "__main__":
    outputs = {}
    for fname, title, desc, body, script, schema in pages:
        outputs[fname] = page(title, desc, fname, body, script=script, schema=page_schema(fname))
    for p in POSTS:
        fname = f"insight-{p['slug']}.html"
        outputs[fname] = page(p["title"] + " | TriadaTechnologies Insights", p["description"], fname,
                              build_post(p), script=True, schema=post_schema(p), og_type="article")
    outputs["404.html"] = page("Page not found | TriadaTechnologies", "The page you are looking for does not exist.", "404.html",
                               hero_card("404", "Page not found.", "The page you are looking for has moved or does not exist.")
                               + '\n<section class="listing"><div class="wrap"><a class="btn btn-white" href="index.html">Go to home</a></div></section>',
                               script=True, noindex=True)
    for name, text in outputs.items():
        with open(name, "w", encoding="utf-8") as f:
            f.write(text)
        print("wrote", name)
    for slug in retired_slugs():
        name = f"insight-{slug}.html"
        if name not in outputs:
            with open(name, "w", encoding="utf-8") as f:
                f.write(redirect_page("insights-archive.html"))
            print("redirect", name)
    dates = lastmod_for({k: v for k, v in outputs.items() if k != "404.html"}, TODAY)
    seo_files(POSTS, TODAY, dates)
    print("wrote sitemap.xml, robots.txt, llms.txt")
