import { displayFont } from "@/lib/fonts";

/** Bio scene with the studio photo behind it. */
export function About() {
    return (
        <div className="about-inner">
            <div className="about-bg">
                <img
                    src="/studio.jpg"
                    alt="Joshua Whatman producing music at a computer in his recording studio as Spencer Lee plays bass behind him."
                />
            </div>

            <div className="about-content">
                <h2 className={`${displayFont.className} about-title`}>About Me</h2>

                <div className="about-copy">
                    <p className="about-lead">Sound Designer, Music Producer - Victoria, BC</p>

                    <p>
                        I fell in love with audio in Winnipeg over 15 years ago. Since then I have
                        obsessed relentlessly, learning everything I could about music production,
                        recording, audio post, radio, concert production, live recording, and more.
                        I’ve been lucky enough to sit in as an intern on professional studio
                        sessions. I operated my own studio in Winnipeg, engineering local artists. I
                        worked for 101.5 UMFM crafting a talk show from scratch. That range of
                        experience, along with my (at times, unsettling) passion for this craft has
                        given me a deep and practical understanding of sound and audio production,
                        informing every detail in my work today.
                    </p>

                    <p>
                        Audio can make or break your work. If you need someone who will obsess over
                        every detail, I’m your guy.
                    </p>
                </div>
            </div>
        </div>
    );
}
